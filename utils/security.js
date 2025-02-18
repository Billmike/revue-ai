async function encryptToken(token) {
  const cryptoKey = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encodedToken = encoder.encode(token);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, 
    cryptoKey, 
    encodedToken
  );

  const exportedKey = await crypto.subtle.exportKey("raw", cryptoKey);
  
  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    key: Array.from(new Uint8Array(exportedKey)),
    iv: Array.from(iv)
  };
}

async function saveToken(token, tokenKey = 'githubToken') {
  const encryptedData = await encryptToken(token);
  
  chrome.storage.local.set({ 
    [tokenKey]: encryptedData.encrypted,
    [`${tokenKey}_key`]: encryptedData.key,  // Unique key for each token
    [`${tokenKey}_iv`]: encryptedData.iv     // Unique IV for each token
  }, () => {
    console.log(`Token securely stored with key: ${tokenKey}`);
  });
}

async function decryptToken(encryptedToken, keyArray, ivArray) {
  const keyBytes = new Uint8Array(keyArray);
  const iv = new Uint8Array(ivArray);
  
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  
  const encryptedBytes = Uint8Array.from(atob(encryptedToken), c => c.charCodeAt(0));
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encryptedBytes
  );

  return new TextDecoder().decode(decrypted);
}

async function getToken(tokenKey = "githubToken") {
  return new Promise((resolve, reject) => {
    chrome.storage.local.get([
      tokenKey, 
      `${tokenKey}_key`, 
      `${tokenKey}_iv`
    ], async (result) => {
      if (!result[tokenKey] || !result[`${tokenKey}_key`] || !result[`${tokenKey}_iv`]) {
        resolve(null);
        return;
      }

      try {
        const decryptedToken = await decryptToken(
          result[tokenKey],
          result[`${tokenKey}_key`],
          result[`${tokenKey}_iv`]
        );
        resolve(decryptedToken);
      } catch (error) {
        console.error('Decryption error:', error);
        reject(error);
      }
    });
  });
}