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
     console.log("PR Diff Data:", diffs);

     // Fetch the commit ID for the PR
     const commitId = await getPRCommitId(prDetails, githubToken);
     console.log("Commit ID:", commitId);

     // Process all files concurrently using Promise.all()
     await Promise.all(
      diffs.map(async (file) => {
        console.log(`Processing file: ${file.filename}`);

        try {
          // Analyze the diff using OpenAI
          const suggestions = await analyzeDiffWithOpenAI(file.patch);
          if (suggestions.type === 'error') {
            showToast(suggestions.content, 'error');
            return;
          }
          console.log(`AI Suggestions for ${file.filename}:`, suggestions);

          // Extract relevant line changes
          const changes = extractChangesFromDiff([file]);

          // Post comments only on the first added line per file
          if (changes.length > 0) {
            const change = changes[0]; // Get only the first added line per file
            await postPRComment(githubToken, prDetails, suggestions.content, change.line, change.file, commitId);
          }
        } catch (error) {
          console.error(`Error processing ${file.filename}:`, error);
          showToast(`Error processing ${file.filename}:`)
        }
      })
    );

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
