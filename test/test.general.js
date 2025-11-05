import {expect} from 'chai';
import {JSDOM} from 'jsdom';
import * as DOTR from '../src/index-node.js';

const doc = `
<html>
<body>

<p>This is a test <b>and another teSt</b> and yet another <i>test</i>.</p>

</body>
</html>
`;

const {document} = new JSDOM(doc, {
  // Perhaps due to a bug the `matchUnbounded` example (with ranges) needed this
  //   set.
  url: 'http://localhost'
}).window;

describe('`execBounded`', () => {
  it('`execBounded` finds a match', () => {
    const regex = /t(e.)t/gv;
    const result = DOTR.execBounded(regex, document.body, {flatten: false});
    // console.log('result', result);
    expect(result).to.deep.equal(['test', 'es']);
    expect(result.input).to.equal('This is a test ');
    expect(result.lastIndex).to.equal(14);
    expect(result.lastCumulativeIndex).to.equal(16);

    const result2 = DOTR.execBounded(regex, document.body, {flatten: false});
    expect(result2).to.deep.equal(['teSt', 'eS']);
    expect(result2.input).to.equal('and another teSt');
    expect(result2.lastIndex).to.equal(16);

    // Todo: Is this right?
    expect(result2.lastCumulativeIndex).to.equal(47);

    const result3 = DOTR.execBounded(
      regex, document.body, {flatten: false, all: false}
    );
    expect(result3).to.deep.equal(['test', 'es']);
    expect(result3.input).to.equal('test');
    expect(result3.lastIndex).to.equal(4);

    // Todo: Is this right?
    expect(result3.lastCumulativeIndex).to.equal(84);
  });

  it('`execBounded` finds matches with `all`', () => {
    const result = DOTR.execBounded(
      /t(e.)t/gv, document.body, {flatten: false, all: true}
    );
    expect(result).to.deep.equal([
      [['test', 'es']], [[['teSt', 'eS']]], [[['test', 'es']]]
    ]);

    const result2 = DOTR.execBounded(
      /t(e.)t/gv, document.body, {flatten: true, all: true}
    );
    expect(result2).to.deep.equal([
      ['test', 'es'], ['teSt', 'eS'], ['test', 'es']
    ]);

    const regex = /t(e.)t/gv;
    const result3 = DOTR.execBounded(
      regex, document.body, {flatten: false, all: false}
    );

    // Todo: Are these expectations corerct?
    expect(result3).to.deep.equal([
      'test', 'es'
    ]);
    expect(result3.lastIndex).to.equal(14);

    const result4 = DOTR.execBounded(regex, document.body, {flatten: false});

    // Todo: Are these expectations corerct?
    expect(result4).to.deep.equal(['teSt', 'eS']);
    expect(result4.lastIndex).to.equal(16);
  });
});

describe('`forEach`', () => {
  it('`forEach` finds a match', function () {
    let s = '';
    DOTR.forEachBounded(/t(e.)t/gv, document.body, function (a, b, c) {
      s += this.a + '::' + a + '::' + b + '::' + c + '\n';
    }, {a: 'newThis'});
    expect(s).to.equal(`newThis::es::0::test
newThis::eS::1::teSt
newThis::es::2::test
`);
  });
});

describe('`splitBounded`', () => {
  it('`splitBounded` finds a match', () => {
    const result = DOTR.splitBounded(/te.t/v, document.body, {returnType: 'html'});
    expect(result).to.deep.equal([
      '\n\n<p>This is a </p>',
      '<p> <b>and another </b></p>',
      '<p><b></b> and yet another <i></i></p>'
    ]);
  });
});

describe('`matchBounded`', () => {
  it('`matchBounded` finds a match', () => {
    const result = DOTR.matchBounded(/te.t/gv, document.body, {flatten: true})[0];
    expect(result).to.equal('test');
    const result2 = DOTR.matchBounded(/te.t/gv, document.body, {flatten: false});
    expect(result2).to.deep.equal([
      ['test'], [['teSt']], [['test']]
    ]);
  });
});

describe('`matchUnbounded`', () => {
  it('`matchUnbounded` finds matches', () => {
    const result = DOTR.matchUnbounded(
      /te.t.*? and/gv, document.body, {returnType: 'range'}
    );

    // Todo: Are these expectations correct?
    expect(result[0].startContainer.nodeValue).to.equal(
      'This is a test '
    );
    expect(result[0].startOffset).to.equal(
      10
    );
    expect(result[0].endContainer.nodeValue).to.equal(
      'and another teSt'
    );
    expect(result[0].endOffset).to.equal(
      3
    );

    expect(result[1].startContainer.nodeValue).to.equal(
      'and another teSt'
    );
    expect(result[1].startOffset).to.equal(
      12
    );
    expect(result[1].endContainer.nodeValue).to.equal(
      ' and yet another '
    );
    expect(result[1].endOffset).to.equal(
      4
    );
  });
});

describe('`searchBounded`', () => {
  it('`searchBounded` finds a match', () => {
    const regex = /t(e.)t/gv;
    const result = DOTR.searchBounded(
      regex, document.body, {stringOffsets: true}
    );

    // Todo: Are these expectations correct?
    expect(result).to.deep.equal([10, 12, 0]);
  });
});

describe('`replaceBounded`', () => {
  it('`replaceBounded` performs a replace', () => {
    const regex = /t(e.)t/gv;
    const result = DOTR.replaceBounded(
      regex, document.body.cloneNode(true), {
        replacement: '<b>DONE$1EE</b>',
        replaceFormat: 'html'/* text|html */,
        replacePatterns: true,
        wrap: 'q',
        replaceNode: true
      }
    );

    /* eslint-disable @stylistic/max-len -- Long */
    const expected = `<body>

<p>This is a <q><b>DONEesEE</b></q> <b>and another <q><b>DONEeSEE</b></q></b> and yet another <i><q><b>DONEesEE</b></q></i>.</p>



</body>`;
    /* eslint-enable @stylistic/max-len -- Long */
    expect(result.outerHTML).to.equal(expected);
  });
});

describe('`replaceUnbounded`', () => {
  it('`replaceUnbounded` performs a replace', () => {
    const result = DOTR.replaceUnbounded(/te(.t.*? and)/gv, document.body, {
      replacement: '<u>DONE$1EE</u>',
      replaceFormat: 'html'/* text|html */,
      replacePatterns: true,
      wrap: 'q',
      replaceNode: true,
      replacePatternsHTML: false,
      portionMode: 'multiple'
    });
    /* eslint-disable @stylistic/max-len -- Long */
    const expected = `<body>

<p>This is a <q><u>DONE$1EE</u></q><b><q><u>DONE$1EE</u></q></b><b> another </b><b><q><u>DONE$1EE</u></q></b><q><u>DONE$1EE</u></q> yet another <i>test</i>.</p>



</body>`;
    /* eslint-enable @stylistic/max-len -- Long */
    expect(result.outerHTML).to.equal(expected);
  });
});
