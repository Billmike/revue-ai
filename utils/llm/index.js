async function analyzeDiffWithOpenAI(diffData, apiKey) {
  console.log("Sending PR diff to OpenAI...");

  const apiUrl = "https://api.openai.com/v1/chat/completions";

  // Create a context that includes complete hunks rather than just changed lines
  const formattedChanges = diffData.changeBlocks.map(block => {
    const lineRange = block.startLine === block.endLine 
      ? `line ${block.startLine}`
      : `lines ${block.startLine}-${block.endLine}`;
    
    const changeLines = block.changes.map(c => 
      `Line ${c.line}: ${c.change}`
    ).join('\n');
    
    return `Changes in ${block.file}, ${lineRange}:\n${changeLines}`;
  }).join('\n\n');

  const messages = [
    { 
      role: "system", 
      content: `You are a code review assistant. Review the following code changes and provide specific feedback.
      For each section of changes, reference the exact line numbers in your feedback.
      Focus on potential issues, improvements, or security concerns in the changed code.
      Keep suggestions concise, actionable, and to the point.
      
      Example format:
      "Lines 50-51: [Your specific feedback about these lines]
      Line 60-61: [Your specific feedback about these lines]"` 
    },
    { role: "user", content: formattedChanges }
  ];

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4-turbo",
      messages,
      temperature: 0.2,
      max_tokens: 300, // Increased to accommodate multiple block references
    }),
  });

  const data = await response.json();

  if (data.error) {
    return {
      type: 'error',
      content: `Error: ${data.error.message}`
    };
  }

  return {
    type: 'success',
    content: data.choices?.[0]?.message?.content || "No suggestions."
  };
}

async function analyzeDiffWithAnthropic(diffData, apiKey) {
  console.log("Sending PR diff to Anthropic...");

  const apiUrl = "https://api.anthropic.com/v1/messages";

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type, x-api-key, anthropic-version"
    },
    mode: "cors",
    body: JSON.stringify({
      model: "claude-3-opus-20240229",
      messages: [{
        role: "user",
        content: `You are a code review assistant. Provide brief, actionable suggestions for the following GitHub PR diff. Focus on the most important improvements needed. Keep suggestions concise and direct, with a maximum of 2-3 key points. Avoid lengthy explanations.

        Here's the diff to review:
        ${diffData}`
      }],
      max_tokens: 150,
      temperature: 0.2
    }),
  });

  const data = await response.json();

  if (data.error) {
    return {
      type: 'error',
      content: `Error: ${data.error.message}`
    };
  }

  return {
    type: 'success',
    content: data.content?.[0]?.text || "No suggestions."
  };
}

async function analayzeDiffWithGemini(diffData, apiKey) {
  console.log("Sending PR diff to Gemini...");

  const apiUrl = "https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent";

  const response = await fetch(`${apiUrl}?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{
        role: "user",
        parts: [{
          text: `You are a code review assistant. Provide brief, actionable suggestions for the following GitHub PR diff. Focus on the most important improvements needed. Keep suggestions concise and direct, with a maximum of 2-3 key points. Avoid lengthy explanations.

          Here's the diff to review:
          ${diffData}`
        }]
      }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 150,
      }
    }),
  });

  const data = await response.json();

  if (data.error) {
    return {
      type: 'error',
      content: `Error: ${data.error.message}`
    };
  }

  // Check if we have a valid response with content
  if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
    return {
      type: 'success',
      content: data.candidates[0].content.parts[0].text
    };
  }

  return {
    type: 'error',
    content: 'No suggestions received from Gemini.'
  };
}

async function handleCallLLM(diffData) {
  const getLLMProvider = await getToken('llmProvider');
  const apiKey = await getToken('llmAPIKEY');
  let suggestions = {}

  if (getLLMProvider === 'openai') {
    suggestions = await analyzeDiffWithOpenAI(diffData, apiKey)
  } else if (getLLMProvider === 'anthropic') {
    suggestions = await analyzeDiffWithAnthropic(diffData, apiKey)
  } else if (getLLMProvider === 'gemini') {
    suggestions = await analayzeDiffWithGemini(diffData, apiKey)
  } else {
    suggestions = {
      type: 'error',
      content: 'Failed to connect to an LLM'
    }
  }

  return suggestions
}

function extractChangesFromDiff(diffData) {
  const changes = [];
  const changeBlocks = [];

  diffData.forEach(file => {
    const patch = file.patch;
    const lines = patch.split("\n");
    let currentLine = 0;
    let currentHunk = [];
    let hunkHeader = null;

    lines.forEach(line => {
      if (line.startsWith("@@")) {
        // Parse hunk header to get correct line numbers
        const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          // Process previous hunk if exists
          if (currentHunk.length > 0 && hunkHeader) {
            const blockStartLine = parseInt(hunkHeader);
            changeBlocks.push({
              startLine: blockStartLine,
              endLine: blockStartLine + currentHunk.length - 1,
              changes: currentHunk,
              file: file.filename
            });
          }
          
          // Start new hunk
          currentLine = parseInt(match[1]);
          hunkHeader = match[1];
          currentHunk = [];
        }
      } else if (!line.startsWith("+++") && !line.startsWith("---")) {
        if (line.startsWith("+")) {
          const change = {
            file: file.filename,
            line: currentLine,
            change: line.slice(1).trim(),
          };
          
          changes.push(change);
          currentHunk.push({
            line: currentLine,
            change: line.slice(1).trim()
          });
          currentLine++;
        } 
        else if (line.startsWith(" ")) {
          // Just increment for context lines
          currentLine++;
        } 
        else if (line.startsWith("-")) {
          // Don't increment for removed lines in the new file
          // These don't affect the new file's line numbers
        }
      }
    });

    // Add the last hunk if it exists
    if (currentHunk.length > 0 && hunkHeader) {
      const blockStartLine = parseInt(hunkHeader);
      changeBlocks.push({
        startLine: blockStartLine,
        endLine: blockStartLine + currentHunk.length - 1,
        changes: currentHunk,
        file: file.filename
      });
    }
  });

  // Consolidate adjacent blocks for better review context
  const mergedBlocks = [];
  changeBlocks.forEach(block => {
    if (block.changes.length === 0) return;
    
    // Find if there's an existing block close to this one
    const lastBlock = mergedBlocks.length > 0 ? mergedBlocks[mergedBlocks.length - 1] : null;
    if (lastBlock && 
        lastBlock.file === block.file && 
        block.startLine - lastBlock.endLine <= 5) { // Merge if blocks are within 5 lines
      lastBlock.endLine = Math.max(lastBlock.endLine, block.endLine);
      lastBlock.changes = [...lastBlock.changes, ...block.changes];
    } else {
      mergedBlocks.push({...block});
    }
  });

  return {
    firstChange: changes.length > 0 ? changes[0] : null,
    changeBlocks: mergedBlocks
  };
}