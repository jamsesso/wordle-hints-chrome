(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (!/http(s?)\:\/\/(.*)powerlanguage\.co\.uk\/wordle/g.test(tab.url)) {
    renderError();
    return;    
  }

  let words = await fetch(chrome.runtime.getURL('dictionary.txt'))
    .then(res => res.text())
    .then(txt => txt.split(`\n`))
    .then(words => words.filter(word => word.length === 5));

  const [{result: rules}] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    function: parseBoardRules
  });

  for (let rule of rules) {
    words = words.filter(word => applyRule(word, rule));
  }

  render(words);
})();

function parseBoardRules() {
  const rulesByLetter = {};
  const gameApp = document.querySelector('game-app').shadowRoot;
  const gameRows = [...gameApp.querySelectorAll('game-row')].map(row => row.shadowRoot);

  for (let i = 0; i < gameRows.length; i++) {
    const gameRow = gameRows[i];
    const gameTiles = [...gameRow.querySelectorAll('game-tile')].map(tile => tile.shadowRoot);

    for (let j = 0; j < gameTiles.length; j++) {
      const gameTile = gameTiles[j];
      const tile = gameTile.querySelector('.tile');
      const letter = tile.innerText;
      const ruleType = tile.getAttribute('data-state');

      if (letter) {
        const newRule = { letter: letter.toUpperCase(), position: j, type: ruleType };
        const existingRule = rulesByLetter[newRule.letter];

        // If there is already a rule for this letter, and one of the rules is 'absent', 
        // then discard the rule because they contradict one another.
        // 'correct' and 'present' do not contradict one another.
        if (existingRule && (existingRule.type === 'absent' || newRule.type === 'absent')) {
          rulesByLetter[newRule.letter] = ([existingRule, newRule].find(rule => rule.type !== 'absent') || existingRule);
        } else {
          rulesByLetter[newRule.letter] = newRule;
        }
      }
    }
  }

  const rules = Object.keys(rulesByLetter).map(letter => rulesByLetter[letter]);
  console.log({rulesByLetter, rules});
  return rules;
}

function applyRule(word, rule) {
  switch (rule.type) {
    case 'correct':
      return word[rule.position] === rule.letter;

    case 'present':
      return word.indexOf(rule.letter) >= 0 && word.indexOf(rule.letter) !== rule.position;

    case 'absent':
      return word.indexOf(rule.letter) < 0;

    default:
      throw new Error('Unknown rule: ' + rule.type);
  }
}

function render(words) {
  const possibilities = document.getElementById('possibilities');
  const count = document.getElementById('num-possibilities');
  let html = '';

  for (let word of words) {
    html += `<span class="word">${word}</span>`;
  }

  possibilities.innerHTML = html;
  count.innerText = words.length.toLocaleString();
}

function renderError() {
  document.getElementById('container').innerHTML = `
    <div id="error">This extension only works at powerlanguage.co.uk/wordle/</div>
  `;
}