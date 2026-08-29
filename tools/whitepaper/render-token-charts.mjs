import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const bundledModules = process.env.CODEX_BUNDLED_NODE_MODULES
  ?? '/Users/hyunsuklee/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules';
const { createCanvas, GlobalFonts } = require(path.join(bundledModules, '@napi-rs/canvas'));

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '../..');
const outputDirectory = path.join(projectRoot, 'docs/whitepaper/analysis');
const fontDirectory = path.join(projectRoot, 'docs/brand/assets/fonts');

GlobalFonts.registerFromPath(path.join(fontDirectory, 'NotoSansKR-Medium.otf'), 'IROA Sans');
GlobalFonts.registerFromPath(path.join(fontDirectory, 'NotoSansKR-Bold.otf'), 'IROA Sans');

const WIDTH = 2400;
const HEIGHT = 1350;
const COLORS = {
  navy: '#16263D',
  ink: '#19222E',
  coral: '#F06D5E',
  ivory: '#F7F3EA',
  paper: '#FFFEFB',
  teal: '#3D8B83',
  lightTeal: '#83CDC4',
  blue: '#246FD4',
  gold: '#D9A441',
  slate: '#718096',
  border: '#D9DEE5',
  muted: '#526174',
  white: '#FFFFFF',
};

function roundedRect(ctx, x, y, width, height, radius, fill, stroke) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

function createChart(title, eyebrow, metric, note) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COLORS.ivory;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.fillStyle = COLORS.coral;
  roundedRect(ctx, 120, 88, 132, 14, 7, COLORS.coral);
  ctx.font = '700 30px "IROA Sans"';
  ctx.fillStyle = COLORS.teal;
  ctx.fillText(eyebrow, 120, 162);

  ctx.font = '700 66px "IROA Sans"';
  ctx.fillStyle = COLORS.navy;
  ctx.fillText(title, 120, 250);

  ctx.textAlign = 'right';
  ctx.font = '700 38px "IROA Sans"';
  ctx.fillStyle = COLORS.navy;
  ctx.fillText(metric, WIDTH - 120, 166);
  ctx.font = '500 24px "IROA Sans"';
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(note, WIDTH - 120, 214);
  ctx.textAlign = 'left';

  return { canvas, ctx };
}

function drawFooter(ctx, source) {
  ctx.strokeStyle = COLORS.border;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(120, HEIGHT - 92);
  ctx.lineTo(WIDTH - 120, HEIGHT - 92);
  ctx.stroke();
  ctx.font = '500 23px "IROA Sans"';
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(source, 120, HEIGHT - 48);
  ctx.textAlign = 'right';
  ctx.fillStyle = COLORS.teal;
  ctx.fillText('IROA.AI · 검증 가능한 보상 경제', WIDTH - 120, HEIGHT - 48);
  ctx.textAlign = 'left';
}

function save(canvas, filename) {
  return writeFile(path.join(outputDirectory, filename), canvas.toBuffer('image/png'));
}

async function renderAllocation() {
  const allocation = [
    ['NODE 구축·운영 보상', 25, COLORS.teal],
    ['생태계 참여 보상', 23, '#56A79E'],
    ['연구개발', 15, COLORS.lightTeal],
    ['팀·자문', 15, COLORS.navy],
    ['초기 투자자', 10, COLORS.coral],
    ['재단·운영 준비금', 7, COLORS.slate],
    ['초기 유동성', 5, COLORS.gold],
  ];
  const { canvas, ctx } = createChart(
    '토큰 배분',
    'TOKEN ALLOCATION',
    '10,000,000,000 IROA',
    '최대 공급량 · 합계 100%',
  );

  const chartX = 610;
  const chartWidth = 1560;
  const top = 340;
  const rowGap = 94;
  const max = 25;

  allocation.forEach(([label, value, color], index) => {
    const y = top + index * rowGap;
    ctx.font = '700 30px "IROA Sans"';
    ctx.fillStyle = COLORS.navy;
    ctx.textAlign = 'right';
    ctx.fillText(label, chartX - 42, y + 47);
    ctx.textAlign = 'left';

    roundedRect(ctx, chartX, y, chartWidth, 64, 32, '#E7E8E4');
    const width = chartWidth * value / max;
    roundedRect(ctx, chartX, y, width, 64, 32, color);

    ctx.font = '700 30px "IROA Sans"';
    ctx.fillStyle = value === 7 || value === 5 ? COLORS.navy : COLORS.white;
    ctx.textAlign = 'right';
    ctx.fillText(`${value}%`, chartX + width - 24, y + 44);
    ctx.textAlign = 'left';
  });

  roundedRect(ctx, 120, 1064, 2160, 112, 28, COLORS.navy);
  ctx.font = '700 31px "IROA Sans"';
  ctx.fillStyle = COLORS.white;
  ctx.fillText('63%', 166, 1133);
  ctx.font = '500 28px "IROA Sans"';
  ctx.fillText('NODE · 생태계 · 연구개발에 집중된 장기 네트워크 예산', 300, 1133);
  drawFooter(ctx, '백서 16.2 · 승인 배분안 기준');
  await save(canvas, 'iroa-token-allocation.png');
}

function buildAnnualSupply() {
  const total = 10_000_000_000;
  const monthly = Array.from({ length: 145 }, () => 0);
  monthly[0] += total * 0.02;
  for (let month = 1; month <= 36; month += 1) monthly[month] += total * 0.03 / 36;

  const spread = (pool, weights) => {
    weights.forEach((weight, yearIndex) => {
      for (let month = yearIndex * 12 + 1; month <= (yearIndex + 1) * 12; month += 1) {
        monthly[month] += pool * weight / 100 / 12;
      }
    });
  };
  const linear = (pool, startMonth, duration) => {
    for (let month = startMonth; month < startMonth + duration; month += 1) monthly[month] += pool / duration;
  };

  spread(total * 0.25, [15, 13, 12, 11, 10, 9, 8, 7, 5, 4, 3, 3]);
  spread(total * 0.23, [12, 12, 11, 11, 10, 10, 9, 9, 8, 8]);
  spread(total * 0.15, [12, 12, 12, 12, 12, 10, 10, 8, 6, 6]);
  linear(total * 0.10, 19, 42);
  linear(total * 0.15, 25, 72);
  linear(total * 0.07, 13, 84);

  const cumulative = [];
  monthly.reduce((sum, value, month) => {
    const next = sum + value;
    cumulative[month] = next;
    return next;
  }, 0);
  return Array.from({ length: 13 }, (_, year) => ({
    year,
    percent: cumulative[year * 12] / total * 100,
  }));
}

async function renderSupply() {
  const annual = buildAnnualSupply();
  const { canvas, ctx } = createChart(
    '누적 유통량 기준 시나리오',
    'CIRCULATING SUPPLY',
    '2.0% → 100%',
    '출시 시점 → 12년 말',
  );
  const plot = { x: 166, y: 360, width: 2068, height: 710 };
  const xFor = (year) => plot.x + plot.width * year / 12;
  const yFor = (percent) => plot.y + plot.height * (1 - percent / 100);

  for (let tick = 0; tick <= 100; tick += 20) {
    const y = yFor(tick);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.width, y);
    ctx.stroke();
    ctx.font = '500 24px "IROA Sans"';
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = 'right';
    ctx.fillText(`${tick}%`, plot.x - 24, y + 8);
  }

  ctx.beginPath();
  ctx.moveTo(xFor(annual[0].year), plot.y + plot.height);
  annual.forEach((point) => ctx.lineTo(xFor(point.year), yFor(point.percent)));
  ctx.lineTo(xFor(annual.at(-1).year), plot.y + plot.height);
  ctx.closePath();
  const gradient = ctx.createLinearGradient(0, plot.y, 0, plot.y + plot.height);
  gradient.addColorStop(0, 'rgba(61,139,131,0.34)');
  gradient.addColorStop(1, 'rgba(131,205,196,0.05)');
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  annual.forEach((point, index) => {
    const x = xFor(point.year);
    const y = yFor(point.percent);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = COLORS.teal;
  ctx.lineWidth = 12;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();

  annual.forEach((point) => {
    const x = xFor(point.year);
    const y = yFor(point.percent);
    ctx.fillStyle = COLORS.paper;
    ctx.beginPath();
    ctx.arc(x, y, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = COLORS.teal;
    ctx.lineWidth = 7;
    ctx.stroke();
    ctx.font = '500 22px "IROA Sans"';
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = 'center';
    ctx.fillText(`${point.year}`, x, plot.y + plot.height + 48);
  });

  const milestones = [0, 1, 5, 10, 12];
  milestones.forEach((year) => {
    const point = annual[year];
    const x = xFor(year);
    const y = yFor(point.percent);
    roundedRect(ctx, x - 74, y - 74, 148, 48, 24, year === 0 ? COLORS.coral : COLORS.navy);
    ctx.font = '700 24px "IROA Sans"';
    ctx.fillStyle = COLORS.white;
    ctx.textAlign = 'center';
    ctx.fillText(`${point.percent.toFixed(1)}%`, x, y - 42);
  });

  const unlocks = [
    { year: 1.5, label: '투자자 잠금 종료', color: COLORS.coral },
    { year: 2, label: '팀·자문 잠금 종료', color: COLORS.gold },
  ];
  unlocks.forEach(({ year, label, color }, index) => {
    const x = xFor(year);
    ctx.setLineDash([12, 12]);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x, plot.y + 60);
    ctx.lineTo(x, plot.y + plot.height);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = '700 22px "IROA Sans"';
    ctx.fillStyle = color;
    ctx.textAlign = 'left';
    ctx.fillText(label, x + 14, plot.y + 34 + index * 34);
  });

  ctx.font = '700 24px "IROA Sans"';
  ctx.fillStyle = COLORS.navy;
  ctx.textAlign = 'center';
  ctx.fillText('출시 후 연도', plot.x + plot.width / 2, plot.y + plot.height + 94);
  ctx.textAlign = 'left';
  drawFooter(ctx, '백서 16.3 · 2% 초기 유통 및 승인 잠금 해제 일정');
  await save(canvas, 'iroa-token-circulating-supply.png');
}

function buildNodeScenarios() {
  const yearWeights = [15, 13, 12, 11, 10, 9, 8, 7, 5, 4, 3, 3];
  const counts = {
    '보수': [100, 200, 400, 700, 1000, 1500, 2200, 3000, 4000, 5000, 6000, 7000],
    '기준': [300, 700, 1500, 3000, 5500, 9000, 14000, 20000, 28000, 38000, 50000, 65000],
    '확장': [800, 2000, 5000, 10000, 18000, 30000, 50000, 80000, 120000, 180000, 250000, 330000],
  };
  return Object.fromEntries(Object.entries(counts).map(([name, nodes]) => {
    const values = nodes.map((nodeCount, index) => 10_000_000_000 * 0.25 * yearWeights[index] / 100 / nodeCount);
    const indexed = values.map((value) => value / values[0] * 100);
    return [name, { values, indexed }];
  }));
}

async function renderNodeDilution() {
  const scenarios = buildNodeScenarios();
  const { canvas, ctx } = createChart(
    'NODE 성장에 따른 보상 희석',
    'NODE REWARD STRESS TEST',
    '1년 차 = 100',
    '12년 기준 시나리오 0.09',
  );
  const plot = { x: 170, y: 380, width: 1510, height: 670 };
  const xFor = (year) => plot.x + plot.width * (year - 1) / 11;
  const minLog = -2;
  const maxLog = 2;
  const yFor = (index) => {
    const log = Math.log10(index);
    return plot.y + plot.height * (maxLog - log) / (maxLog - minLog);
  };

  [100, 10, 1, 0.1, 0.01].forEach((tick) => {
    const y = yFor(tick);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = tick === 100 ? 4 : 2;
    ctx.beginPath();
    ctx.moveTo(plot.x, y);
    ctx.lineTo(plot.x + plot.width, y);
    ctx.stroke();
    ctx.font = '500 24px "IROA Sans"';
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = 'right';
    ctx.fillText(String(tick), plot.x - 24, y + 8);
  });

  const styles = {
    '보수': { color: COLORS.teal, dash: [] },
    '기준': { color: COLORS.coral, dash: [18, 12] },
    '확장': { color: COLORS.gold, dash: [5, 12] },
  };
  Object.entries(scenarios).forEach(([name, scenario]) => {
    const style = styles[name];
    ctx.beginPath();
    scenario.indexed.forEach((value, index) => {
      const x = xFor(index + 1);
      const y = yFor(value);
      if (index === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.setLineDash(style.dash);
    ctx.strokeStyle = style.color;
    ctx.lineWidth = 9;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.setLineDash([]);
    scenario.indexed.forEach((value, index) => {
      ctx.beginPath();
      ctx.arc(xFor(index + 1), yFor(value), 10, 0, Math.PI * 2);
      ctx.fillStyle = style.color;
      ctx.fill();
    });
  });

  for (let year = 1; year <= 12; year += 1) {
    ctx.font = '500 22px "IROA Sans"';
    ctx.fillStyle = COLORS.muted;
    ctx.textAlign = 'center';
    ctx.fillText(String(year), xFor(year), plot.y + plot.height + 46);
  }
  ctx.font = '700 24px "IROA Sans"';
  ctx.fillStyle = COLORS.navy;
  ctx.fillText('출시 후 연도', plot.x + plot.width / 2, plot.y + plot.height + 92);

  const cardX = 1760;
  const cards = Object.entries(scenarios);
  cards.forEach(([name, scenario], index) => {
    const y = 390 + index * 206;
    roundedRect(ctx, cardX, y, 480, 170, 28, COLORS.paper, COLORS.border);
    ctx.lineWidth = 3;
    roundedRect(ctx, cardX + 28, y + 28, 62, 18, 9, styles[name].color);
    ctx.font = '700 30px "IROA Sans"';
    ctx.fillStyle = COLORS.navy;
    ctx.textAlign = 'left';
    ctx.fillText(`${name} 시나리오`, cardX + 110, y + 54);
    ctx.font = '500 23px "IROA Sans"';
    ctx.fillStyle = COLORS.muted;
    const lastIndex = scenario.indexed.at(-1);
    ctx.fillText(`12년 지수  ${lastIndex.toFixed(2)}`, cardX + 32, y + 102);
    ctx.fillText(`NODE당  ${Math.round(scenario.values.at(-1)).toLocaleString('ko-KR')} IROA`, cardX + 32, y + 140);
  });
  roundedRect(ctx, cardX, 1020, 480, 92, 24, COLORS.navy);
  ctx.font = '700 25px "IROA Sans"';
  ctx.fillStyle = COLORS.white;
  ctx.textAlign = 'center';
  ctx.fillText('고정수익이 아닌 성과형 보상', cardX + 240, 1077);
  ctx.textAlign = 'left';
  drawFooter(ctx, '백서 16.4 · 승인 NODE 수 및 12년 배출 가중치');
  await save(canvas, 'iroa-node-reward-dilution.png');
}

await mkdir(outputDirectory, { recursive: true });
await renderAllocation();
await renderSupply();
await renderNodeDilution();
console.log('Rendered 3 IROA token-economy charts.');
