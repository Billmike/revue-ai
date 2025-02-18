document.getElementById("saveToken").addEventListener("click", async () => {
  const githubTokenInput = document.getElementById("githubToken");
  const llmAPIKeyInput = document.getElementById("llmAPIKEY");

  // Clear any existing error states
  githubTokenInput.classList.remove('error');
  llmAPIKeyInput.classList.remove('error');

  // Get the values and trim whitespace
  const githubToken = githubTokenInput.value.trim();
  const openAIAccessKey = llmAPIKeyInput.value.trim();

  // Validate both fields
  if (!githubToken || !openAIAccessKey) {
    // Add error styling to empty fields
    if (!githubToken) githubTokenInput.classList.add('error');
    if (!openAIAccessKey) llmAPIKeyInput.classList.add('error');
    
    showToast("Please fill in all required fields", "error");
    return;
  }

  try {
    await saveToken(githubToken);
    await saveToken(openAIAccessKey, 'llmAPIKEY');
    showToast("Tokens saved successfully!");
    
    // Clear error states after successful save
    githubTokenInput.classList.remove('error');
    llmAPIKeyInput.classList.remove('error');
  } catch (error) {
    showToast("Failed to save tokens", "error");
  }
});