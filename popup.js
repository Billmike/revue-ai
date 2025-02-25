document.getElementById("run-review").addEventListener("click", async () => {
  // Disable the button and change the text while the review is in progress
  const reviewButton = document.getElementById("run-review");
  reviewButton.disabled = true;
  reviewButton.textContent = "Review in progress...";

  chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
    const tab = tabs[0];

    // Extract PR details from the GitHub URL
    const prDetails = extractPRDetails(tab.url);
    if (!prDetails) {
      showToast("Not a valid GitHub PR page!", "error");
      reviewButton.disabled = false;
      reviewButton.textContent = "Run Review";
      return;
    }

    try {
      const githubToken = await getToken();

      if (!githubToken) {
        showToast("GitHub token not found. Please set it in extension settings.", 'error');
        reviewButton.disabled = false;
        reviewButton.textContent = "Run Review";
        return;
      }

      // Fetch PR diffs
     const diffs = await fetchPRDiffs(prDetails, githubToken);

     // Fetch the commit ID for the PR
     const commitId = await getPRCommitId(prDetails, githubToken);

     // Track errors across all files
     let hasLLMError = {
      status: false,
      errorMessage: ''
     };
     let hasProcessingError = false;

     // Process all files concurrently using Promise.all()
     await Promise.all(
      diffs.map(async (file) => {

        try {
          // Extract relevant line changes
          const changes = extractChangesFromDiff([file]);

          if (changes.firstChange) {
            const suggestions = await handleCallLLM({
              patch: file.patch,
              changeBlocks: changes.changeBlocks
            });
    
            if (suggestions.type === 'error') {
              hasLLMError = true;
              return;
            }
    
            // Post the comment on the first change
            await postPRComment(
              githubToken, 
              prDetails, 
              suggestions.content, 
              changes.firstChange.line, 
              changes.firstChange.file, 
              commitId
            );
          }

        } catch (error) {
          hasProcessingError = true;
          showToast(`Error processing ${file.filename}:`)
        }
      })
    );

    // Show error toast only once if any errors occurred
    if (hasLLMError.status) {
      showToast(hasLLMError.errorMessage, 'error');
    } else if (hasProcessingError) {
      showToast("Error processing one or more files.", 'error');
    } else {
      showToast("Review completed successfully!");
    }

    // Re-enable button after review is done
    reviewButton.disabled = false;
    reviewButton.textContent = "Run Review";

    // Reload the GitHub PR page
    chrome.tabs.reload();
    } catch (error) {
      showToast("An error occurred.", 'error');
      reviewButton.disabled = false;
      reviewButton.textContent = "Run Review";
    }
  });
});


document.getElementById("open-settings").addEventListener("click", () => {
  document.getElementById("main-view").style.display = "none";
  document.getElementById("settings-view").style.display = "block";
});

document.getElementById("back-to-main").addEventListener("click", () => {
  document.getElementById("settings-view").style.display = "none";
  document.getElementById("main-view").style.display = "block";
});

function showToast(message, type = "success") {
  Toastify({
    text: message,
    duration: 3000, // 3 seconds
    close: true,
    gravity: "top", 
    position: "right", 
    backgroundColor: type === "success" ? "green" : "red",
    stopOnFocus: true,
  }).showToast();
}
