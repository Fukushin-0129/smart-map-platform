import assert from 'node:assert/strict';
import test from 'node:test';

import { addMedia, findDuplicateMedia, moveMedia, removeMedia, setMainMedia, updateMedia } from '../src/modules/mediaManager.js';

const photo = (id, hash = id) => ({ id, hash, name: `${id}.jpg`, isMain: false });

test('同じハッシュの画像を重複登録しない', () => {
  const first = photo('first', 'same');
  const duplicate = photo('second', 'same');
  assert.equal(findDuplicateMedia([first], duplicate), first);
  assert.deepEqual(addMedia([first], duplicate), [first]);
});

test('最初の画像をメイン画像にする', () => {
  assert.deepEqual(addMedia([], photo('first')), [{ ...photo('first'), isMain: true }]);
});

test('キャプション編集時もIDを変更しない', () => {
  assert.deepEqual(updateMedia([photo('first')], 'first', { id: 'other', caption: '入口' }), [{ ...photo('first'), caption: '入口' }]);
});

test('画像を並び替えられる', () => {
  assert.deepEqual(moveMedia([photo('a'), photo('b')], 'b', -1).map(({ id }) => id), ['b', 'a']);
});

test('メイン画像を削除すると次の画像をメインにする', () => {
  const items = [{ ...photo('a'), isMain: true }, photo('b')];
  assert.deepEqual(removeMedia(items, 'a'), [{ ...photo('b'), isMain: true }]);
});

test('メイン画像を一枚だけ設定する', () => {
  assert.deepEqual(setMainMedia([photo('a'), photo('b')], 'b').map(({ isMain }) => isMain), [false, true]);
});
