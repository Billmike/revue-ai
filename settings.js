document.getElementById("saveToken").addEventListener("click", async () => {
  const githubTokenInput = document.getElementById("githubToken");
  const llmAPIKeyInput = document.getElementById("llmAPIKEY");
  const llmProviderInput = document.getElementById("llmProvider");

  // Clear any existing error states
  githubTokenInput.classList.remove('error');
  llmAPIKeyInput.classList.remove('error');
  llmProviderInput.classList.remove('error');

  // Get the values and trim whitespace
  const githubToken = githubTokenInput.value.trim();
  const llmAPIKey = llmAPIKeyInput.value.trim();
  const llmProvider = llmProviderInput.value;

  // Validate all fields
  let hasError = false;

  if (!githubToken) {
    githubTokenInput.classList.add('error');
    hasError = true;
  }
  
  if (!llmAPIKey) {
    llmAPIKeyInput.classList.add('error');
    hasError = true;
  }

  if (!llmProvider) {
    llmProviderInput.classList.add('error');
    hasError = true;
  }

  if (hasError) {
    showToast("Please fill in all required fields", "error");
    return;
  }

  try {
    await saveToken(githubToken);
    await saveToken(llmAPIKey, 'llmAPIKEY');
    await saveToken(llmProvider, 'llmProvider'); // Save the selected provider
    showToast("Settings saved successfully!");
    
    // Clear error states after successful save
    githubTokenInput.classList.remove('error');
    llmAPIKeyInput.classList.remove('error');
    llmProviderInput.classList.remove('error');
  } catch (error) {
    showToast("Failed to save settings", "error");
  }
});
