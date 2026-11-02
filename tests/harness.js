/* Tiny test harness shared by tests/index.html and evals/index.html (no dependencies).
   A check is `check(name, actual, expected[, tolerance])`; numbers are compared with a tolerance, everything else by JSON.
   Checks that need the network or an iframe register their promise with `later(...)`; `finish()` waits for all of them,
   prints the summary and sets document.title to "PASSED <n>" or "FAILED" (with an optional prefix, e.g. "EVALS") — that title is what the runner scripts read. */
const L = window.SP && SP.logic, S = window.SP && SP.sheets;
let pass = 0, failed = 0;
const pending = [];
const later = (promise) => { pending.push(promise); return promise; };

function check(name, actual, expected, tol) {
  const good = typeof expected === 'number' ? Math.abs(actual - expected) <= (tol ?? 1e-9) : JSON.stringify(actual) === JSON.stringify(expected);
  good ? pass++ : failed++;
  const li = document.createElement('li');
  li.className = good ? 'ok' : 'fail';
  li.textContent = (good ? 'PASS ' : 'FAIL ') + name + (good ? '' : ' — got ' + JSON.stringify(actual) + ', expected ' + JSON.stringify(expected));
  document.getElementById('out').appendChild(li);
}

function finish(prefix) {
  return Promise.allSettled(pending).then(() => {
    document.getElementById('summary').innerHTML = '<b class="' + (failed ? 'fail' : 'ok') + '">' + pass + ' passed, ' + failed + ' failed</b>';
    document.title = (prefix ? prefix + ' ' : '') + (failed ? 'FAILED' : 'PASSED ' + pass);
  });
}

// A line of information that is not a pass/fail (eval scores, lists of misses). Printed by the runner scripts.
function info(text) {
  const li = document.createElement('li');
  li.className = 'info';
  li.textContent = text;
  document.getElementById('out').appendChild(li);
}
