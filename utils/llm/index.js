async function analyzeDiffWithOpenAI(diffData, apiKey) {
  console.log("Sending PR diff to OpenAI...");

  const apiUrl = "https://api.openai.com/v1/chat/completions";

  // Format the changes for the LLM
  const formattedChanges = diffData.changeBlocks.map(block => {
    const lineRange = block.startLine === block.endLine 
      ? `line ${block.startLine}`
      : `lines ${block.startLine}-${block.endLine}`;
    
    return `Changes at ${lineRange}:\n${block.changes.map(c => c.change).join('\n')}`;
  }).join('\n\n');

  const messages = [
    { 
      role: "system", 
      content: `You are a code review assistant. Review the following code changes and provide specific feedback for each changed section. 
      Format your response by referencing the line numbers for each piece of feedback.
      Keep each suggestion concise and actionable. Focus on the most important improvements needed.
      Example format:
      "Lines 50-52: [Your specific feedback for these lines]
      Line 84: [Your specific feedback for this line]"` 
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
      max_tokens: 250, // Increased slightly to accommodate line references
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
    let currentBlock = {
      startLine: null,
      endLine: null,
      changes: []
    };

    lines.forEach(line => {
      if (line.startsWith("@@")) {
        const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          currentLine = parseInt(match[1]);
          if (currentBlock.changes.length > 0) {
            changeBlocks.push({
              ...currentBlock,
              endLine: currentLine - 1
            });
          }
          currentBlock = {
            startLine: currentLine,
            endLine: null,
            changes: []
          };
        }
      } else if (!line.startsWith("+++") && !line.startsWith("---")) {
        if (line.startsWith("+")) {
          const change = {
            file: file.filename,
            line: currentLine,
            change: line.slice(1).trim(),
          };
          
          changes.push(change);
          currentBlock.changes.push(change);
          currentLine++;
        } 
        else if (line.startsWith(" ") || line.startsWith("-")) {
          currentLine++;
        }
      }
    });

    // Add the last block if it has changes
    if (currentBlock.changes.length > 0) {
      changeBlocks.push({
        ...currentBlock,
        endLine: currentLine
      });
    }
  });

  return {
    firstChange: changes[0], // For posting the comment
    changeBlocks: changeBlocks // For providing context to LLM
  };
}