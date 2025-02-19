async function analyzeDiffWithOpenAI(diffData, apiKey) {
  console.log("Sending PR diff to OpenAI...");

  const apiUrl = "https://api.openai.com/v1/chat/completions";

  const messages = [
    { 
      role: "system", 
      content: "You are a code review assistant. Provide brief, actionable suggestions for the following GitHub PR diff. Focus on the most important improvements needed. Keep suggestions concise and direct, with a maximum of 2-3 key points. Avoid lengthy explanations." 
    },
    { role: "user", content: diffData }
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
      temperature: 0.2, // Lowered temperature for more focused responses
      max_tokens: 150,  // Limit response length
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

}

async function handleCallLLM(diffData) {
  const getLLMProvider = await getToken('llmProvider');
  const apiKey = await getToken('llmAPIKEY');
  let suggestions = {}

  if (getLLMProvider === 'openai') {
    suggestions = await analyzeDiffWithOpenAI(diffData, apiKey)
  } else if (getLLMProvider === '') {
    suggestions = await analyzeDiffWithAnthropic(diffData, apiKey)
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

  diffData.forEach(file => {
    const patch = file.patch;
    const lines = patch.split("\n");
    let currentLine = 0;
    let hunkStartLine = null;

    lines.forEach(line => {
      if (line.startsWith("@@")) {
        const match = line.match(/@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
        if (match) {
          currentLine = parseInt(match[1]);
          hunkStartLine = currentLine;
        }
      } else if (!line.startsWith("+++") && !line.startsWith("---")) {
        // For added lines, record the change
        if (line.startsWith("+")) {
          changes.push({
            file: file.filename,
            line: currentLine,
            change: line.slice(1).trim(),
          });
          currentLine++;
        } 
        // For context lines (space) and removed lines (-), just increment the counter
        else if (line.startsWith(" ") || line.startsWith("-")) {
          currentLine++;
        }
      }
    });
  });

  return changes;
}