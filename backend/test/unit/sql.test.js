const { test } = require('node:test');
const assert = require('node:assert/strict');
const { patronContiene } = require('../../src/shared/sql');

test('patronContiene envuelve el texto y escapa los comodines de LIKE', () => {
  assert.equal(patronContiene('agua'), '%agua%');
  assert.equal(patronContiene('100%'), '%100\\%%');
  assert.equal(patronContiene('a_b'), '%a\\_b%');
  assert.equal(patronContiene('a\\b'), '%a\\\\b%');
});
