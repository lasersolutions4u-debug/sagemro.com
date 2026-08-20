import assert from 'node:assert/strict';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '../..');

function read(relativePath) {
  return readFileSync(path.join(root, relativePath), 'utf8');
}

test('engineer overview video keeps localized media and reduced-motion fallbacks', () => {
  const componentPath = 'frontend/src/components/Engineer/EngineerOverviewVideo.jsx';
  assert.equal(existsSync(path.join(root, componentPath)), true, 'overview video component should exist');

  const source = read(componentPath);
  assert.match(source, /prefers-reduced-motion: reduce/);
  assert.match(source, /muted/);
  assert.match(source, /playsInline/);
  assert.match(source, /autoPlay=\{!reduceMotion\}/);
  assert.match(source, /loop/);
  assert.match(source, /preload="metadata"/);
  assert.match(source, /engineer-service-flywheel-cn\.webm/);
  assert.match(source, /engineer-service-flywheel-en\.webm/);
  assert.match(source, /engineer-service-flywheel-cn\.mp4/);
  assert.match(source, /engineer-service-flywheel-en\.mp4/);
  assert.match(source, /engineer-service-flywheel-cn-poster\.webp/);
  assert.match(source, /engineer-service-flywheel-en-poster\.webp/);
  assert.match(source, /onError/);
  assert.match(source, /aria-hidden="true"/);
});

test('engineer overview video ships nonempty localized media assets', () => {
  const assets = [
    'frontend/public/media/engineer-service-flywheel-cn.webm',
    'frontend/public/media/engineer-service-flywheel-cn.mp4',
    'frontend/public/media/engineer-service-flywheel-cn-poster.webp',
    'frontend/public/media/engineer-service-flywheel-en.webm',
    'frontend/public/media/engineer-service-flywheel-en.mp4',
    'frontend/public/media/engineer-service-flywheel-en-poster.webp',
  ];

  for (const assetPath of assets) {
    const absolutePath = path.join(root, assetPath);
    assert.equal(existsSync(absolutePath), true, `${assetPath} should exist`);
    assert.ok(statSync(absolutePath).size > 0, `${assetPath} should not be empty`);
  }
});

test('engineer recruiting page keeps the approved concise partnership story', () => {
  const source = read('frontend/src/components/Engineer/EngineerRecruitingPage.jsx');

  assert.doesNotMatch(source, /<EngineerOverviewVideo/);
  assert.match(source, /让专业工程师价值最大化/);
  assert.match(source, /Maximize the Value of Professional Engineers/);
  assert.match(source, /工程师最关心的三个问题/);
  assert.match(source, /少处理琐事，多专注有价值的现场服务/);
  assert.match(source, /全国共享客服中心/);
  assert.match(source, /配件集采与供应链/);
  assert.match(source, /新媒体营销与获客/);
  assert.match(source, /AI 与知识库运营/);
  assert.match(source, /合作原则/);
});
