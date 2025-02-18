// Extracts repo owner, name, and PR number from URL
function extractPRDetails(url) {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], prNumber: match[3] };
}

// Fetch PR diffs from GitHub API
async function fetchPRDiffs({ owner, repo, prNumber }, token) {
  const reviewButton = document.getElementById("run-review");
  const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}/files`;

  const response = await fetch(url, {
    headers: {
      "Authorization": `token ${token}`,
      "Accept": "application/vnd.github.v3+json"
    }
  });

  if (!response.ok) {
    reviewButton.disabled = false;
    reviewButton.textContent = "Run Review";
    showToast(`Failed to fetch PR diffs: ${response.status}`, 'error')
    return [];
  }

  const files = await response.json();
  return files.map(file => ({
    filename: file.filename,
    patch: file.patch
  }));
}

async function postPRComment(githubToken, prDetails, comment, position, file, commitId) {
  const url = `https://api.github.com/repos/${prDetails.owner}/${prDetails.repo}/pulls/${prDetails.prNumber}/comments`;
  const reviewButton = document.getElementById("run-review");

  const body = {
    body: comment,
    path: file,
    commit_id: commitId,
    line: position,
    side: "RIGHT"
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${githubToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await response.json();
  if (data.id) {
  } else {
    console.error('Failed to post comment:', data);
    reviewButton.disabled = false;
    reviewButton.textContent = "Run Review";
    showToast('Failed to post comment:', 'error')
  }
}

async function getPRCommitId(prDetails, githubToken) {
  const url = `https://api.github.com/repos/${prDetails.owner}/${prDetails.repo}/pulls/${prDetails.prNumber}`;
  const response = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${githubToken}`,
    },
  });

  const prData = await response.json();
  return prData.head.sha; // This returns the commit ID
}