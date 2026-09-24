import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

// 后台裁剪后仍需要「加载失败可重试」的页面只剩注册用户管理。
for (const page of ['UsersPage.jsx']) {
  test(`${page} exposes a retryable load error instead of silently hiding it`, async () => {
    const source = await readFile(new URL(`./${page}`, import.meta.url), 'utf8');

    assert.match(source, /loadError/);
    assert.match(source, /Retry|重试/);
    assert.doesNotMatch(source, /\.catch\(\(\) => \{\}\)/);
  });
}

test('the user statistics page exposes a retryable load error', async () => {
  const source = await readFile(new URL('./DashboardPage.jsx', import.meta.url), 'utf8');

  assert.match(source, /error/);
  assert.match(source, /Retry|重试/);
});
