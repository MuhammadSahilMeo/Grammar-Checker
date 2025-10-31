/* ----------------- Utility Functions ----------------- */
function escapeHtml(text = '') {
  return text.replace(/[&<>"'`]/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;',
  }[c]));
}

function tokenize(text) {
  return text.split(/\s+/).filter(Boolean).map(tok => ({
    original: tok,
    norm: tok.toLowerCase().replace(/^[^\w]+|[^\w]+$/g, ''),
  }));
}

function computeLCS(aNorm, bNorm) {
  const n = aNorm.length, m = bNorm.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (aNorm[i - 1] === bNorm[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  let i = n, j = m;
  const pairs = [];
  while (i > 0 && j > 0) {
    if (aNorm[i - 1] === bNorm[j - 1]) {
      pairs.push([i - 1, j - 1]);
      i--; j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) i--;
    else j--;
  }
  pairs.reverse();
  return { length: dp[n][m], pairs };
}

/* ----------------- DOM Elements ----------------- */
const inputEl = document.getElementById('inputText');
const checkBtn = document.getElementById('checkBtn');
const clearBtn = document.getElementById('clearBtn');
const statusEl = document.getElementById('status');
const correctedOutputEl = document.getElementById('correctedOutput');
const wordsTotalEl = document.getElementById('wordsTotal');
const wordsChangedEl = document.getElementById('wordsChanged');
const sentencesChangedEl = document.getElementById('sentencesChanged');
const changedListContainer = document.getElementById('changedListContainer');
const scoreCircle = document.getElementById('scoreCircle');
const progressFill = document.getElementById('progressFill');
const scoreText = document.getElementById('scoreText');
const copyCorrectedBtn = document.getElementById('copyCorrected');
const downloadCorrectedBtn = document.getElementById('downloadCorrected');
const toggleHighlightBtn = document.getElementById('toggleHighlightBtn');
let highlightsOn = true;

/* ----------------- Gemini API Grammar Correction ----------------- */
async function fetchCorrectedText(originalText) {
  const API_KEY = "AIzaSyDJFb1jjEn7Tn1SlShfYPRb8hjVWgiurrw";
  const MODEL_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=${API_KEY}`;

  const prompt = `Correct the grammar, punctuation, and sentence structure of the following text while keeping its meaning the same. Return only the corrected version:\n\n${originalText}`;

  try {
    const res = await fetch(MODEL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    const data = await res.json();
    if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text.trim();
    } else {
      throw new Error("Unexpected Gemini API response.");
    }
  } catch (err) {
    console.error("Error fetching from Gemini API:", err);
    throw new Error("Failed to fetch from Gemini model.");
  }
}

/* ----------------- Main Logic ----------------- */
async function doCheck() {
  const originalText = inputEl.value.trim();
  if (!originalText) {
    statusEl.textContent = 'Please enter some text to analyze.';
    return;
  }

  statusEl.textContent = 'Analyzing...';
  checkBtn.disabled = true;

  try {
    const correctedText = await fetchCorrectedText(originalText);

    const originalTokens = tokenize(originalText);
    const correctedTokens = tokenize(correctedText);
    const aNorm = originalTokens.map(t => t.norm);
    const bNorm = correctedTokens.map(t => t.norm);
    const { length: lcsLen, pairs } = computeLCS(aNorm, bNorm);

    const wordsTotal = originalTokens.length || correctedTokens.length;
    const wordsChanged = Math.max(0, originalTokens.length - lcsLen);
    const sentencesChanged = computeSentenceChanges(originalText, correctedText);

    const matchedCorrectedIndices = new Set(pairs.map(p => p[1]));
    const correctedHtml = correctedTokens.map((tok, idx) => {
      const safe = escapeHtml(tok.original);
      if (!highlightsOn) return safe;
      return matchedCorrectedIndices.has(idx)
        ? `<span class="word-unchanged">${safe}</span>`
        : `<span class="word-changed">${safe}</span>`;
    }).join(' ');

    correctedOutputEl.innerHTML = `
      <div class="highlighted">${correctedHtml}</div>
      <hr/>
      <pre class="plain">${escapeHtml(correctedText)}</pre>
    `;

    wordsTotalEl.textContent = wordsTotal;
    wordsChangedEl.textContent = wordsChanged;
    sentencesChangedEl.textContent = sentencesChanged;

    const changedWordsList = correctedTokens.filter((_, idx) => !matchedCorrectedIndices.has(idx))
      .slice(0, 30).map(t => t.original);
    changedListContainer.innerHTML = changedWordsList.length
      ? `<p><strong>Changed words:</strong> ${escapeHtml(changedWordsList.join(', '))}</p>`
      : `<p class="muted">No major changes detected.</p>`;

    const rate = wordsTotal === 0 ? 0 : Math.round((wordsChanged / wordsTotal) * 100);
    scoreCircle.textContent = `${rate}%`;
    progressFill.style.width = `${rate}%`;
    scoreText.textContent = `Change rate: ${rate}% (${wordsChanged} of ${wordsTotal} words changed)`;

    statusEl.textContent = 'Done.';
  } catch (err) {
    statusEl.textContent = 'Error: ' + (err.message || 'Something went wrong.');
    statusEl.classList.add('error');
  } finally {
    checkBtn.disabled = false;
  }
}

/* ----------------- Helper & Events ----------------- */
function computeSentenceChanges(a, b) {
  const aS = a.split(/[.?!]+/).map(s => s.trim()).filter(Boolean);
  const bS = b.split(/[.?!]+/).map(s => s.trim()).filter(Boolean);
  const aNorm = aS.map(s => s.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, ''));
  const bNorm = bS.map(s => s.toLowerCase().replace(/\s+/g, ' ').replace(/[^\w\s]/g, ''));
  const { length } = computeLCS(aNorm, bNorm);
  return Math.max(aS.length, bS.length) - length;
}

checkBtn.addEventListener('click', doCheck);
clearBtn.addEventListener('click', () => {
  inputEl.value = '';
  correctedOutputEl.innerHTML = `<pre class="plain">No results yet. Click "Check Grammar" to begin.</pre>`;
  wordsTotalEl.textContent = '—';
  wordsChangedEl.textContent = '—';
  sentencesChangedEl.textContent = '—';
  changedListContainer.innerHTML = '';
  scoreCircle.textContent = '—%';
  progressFill.style.width = '0%';
  scoreText.textContent = 'Change rate: —';
  statusEl.textContent = '';
});
toggleHighlightBtn.addEventListener('click', () => {
  highlightsOn = !highlightsOn;
  toggleHighlightBtn.textContent = highlightsOn ? 'Hide Highlights' : 'Show Highlights';
  if (correctedOutputEl.innerText.trim() && correctedOutputEl.innerText !== 'No results yet. Click "Check Grammar" to begin.') doCheck();
});
copyCorrectedBtn.addEventListener('click', async () => {
  const plainEl = correctedOutputEl.querySelector('pre.plain');
  if (!plainEl) return;
  await navigator.clipboard.writeText(plainEl.textContent);
  statusEl.textContent = 'Corrected text copied.';
});
downloadCorrectedBtn.addEventListener('click', () => {
  const plainEl = correctedOutputEl.querySelector('pre.plain');
  if (!plainEl) return;
  const blob = new Blob([plainEl.textContent], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'corrected.txt';
  a.click();
  URL.revokeObjectURL(url);
});
document.getElementById('demoBtn').addEventListener('click', () => {
  inputEl.value = "this is a demo text where i write bad grammar. i hope it will correct teh mistakes.  i am looking forward to it!";
});
document.getElementById('year').textContent = new Date().getFullYear();
inputEl.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') doCheck();
});
