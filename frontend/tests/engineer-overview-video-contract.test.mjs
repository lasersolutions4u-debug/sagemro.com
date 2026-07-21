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

test('engineer recruiting page adds the overview after the hero without replacing detailed content', () => {
  const source = read('frontend/src/components/Engineer/EngineerRecruitingPage.jsx');

  assert.match(source, /import \{ EngineerOverviewVideo \} from '\.\/EngineerOverviewVideo';/);
  assert.match(source, /overviewLabel: '20 秒了解协作模式'/);
  assert.match(source, /overviewLabel: 'The model in 20 seconds'/);
  assert.match(source, /<EngineerOverviewVideo locale=\{locale\} \/>/);
  assert.ok(source.indexOf('<EngineerOverviewVideo locale={locale} />') < source.indexOf('copy.audienceTitle'));
  assert.match(source, /copy\.workflowTitle/);
  assert.match(source, /copy\.faqTitle/);
  assert.match(source, /设备维保最佳方案：AI知识飞轮\+工程师技能实践。/);
  assert.match(source, /A better equipment service model: AI knowledge flywheel \+ engineer expertise\./);
  assert.match(source, /咨询接待，任务整理/);
  assert.match(source, /确认方案，解决问题/);
  assert.match(source, /协调流程，沉淀记录/);
  assert.match(source, /一个越来越懂客户的AI，让技术服务更高效/);
  assert.match(source, /专注于技术服务/);
  assert.match(source, /减少反复沟通，避免无效上门/);
  assert.match(source, /知识技能持续进化，服务能力无限增长/);
  assert.match(source, /从单打独斗，到共享规模化能力/);
  assert.match(source, /共享更有竞争力的供应链/);
  assert.match(source, /共享品牌和市场获客能力/);
  assert.match(source, /共享持续进阶的工程师培训/);
  assert.match(source, /逐步建立可信的工程师能力标准/);
  assert.match(source, /Shared supply chain capability/);
  assert.match(source, /Shared brand and customer acquisition/);
  assert.match(source, /Progressive engineer training/);
});
