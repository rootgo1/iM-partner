/* Local, dependency-free PDF summary. No network, external AI or server storage. */
(function (root) {
  'use strict';
  const encode = text => new TextEncoder().encode(text);
  function join(parts) {
    const output = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
    let offset = 0;
    parts.forEach(p => { output.set(p, offset); offset += p.length; });
    return output;
  }
  function buildPdf(jpegs, width, height) {
    const objects = [], pageIds = [];
    objects[1] = encode('<< /Type /Catalog /Pages 2 0 R >>');
    jpegs.forEach((jpeg, i) => {
      const page = 3 + i * 3, image = page + 1, content = page + 2;
      pageIds.push(page);
      objects[page] = encode('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ' + image + ' 0 R >> >> /Contents ' + content + ' 0 R >>');
      objects[image] = join([encode('<< /Type /XObject /Subtype /Image /Width ' + width + ' /Height ' + height + ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.length + ' >>\nstream\n'), jpeg, encode('\nendstream')]);
      const draw = encode('q\n595.28 0 0 841.89 0 0 cm\n/Im0 Do\nQ\n');
      objects[content] = join([encode('<< /Length ' + draw.length + ' >>\nstream\n'), draw, encode('endstream')]);
    });
    objects[2] = encode('<< /Type /Pages /Count ' + pageIds.length + ' /Kids [' + pageIds.map(id => id + ' 0 R').join(' ') + '] >>');
    const parts = [encode('%PDF-1.4\n')], offsets = [0];
    let length = parts[0].length;
    for (let id = 1; id < objects.length; id++) {
      offsets[id] = length;
      const part = join([encode(id + ' 0 obj\n'), objects[id], encode('\nendobj\n')]);
      parts.push(part); length += part.length;
    }
    const xref = length;
    parts.push(encode('xref\n0 ' + objects.length + '\n0000000000 65535 f \n' +
      offsets.slice(1).map(n => String(n).padStart(10, '0') + ' 00000 n \n').join('') +
      'trailer\n<< /Size ' + objects.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n'));
    return join(parts);
  }
  function renderCanvases(options, createCanvas) {
    const width = 1240, height = 1754, margin = 86, bottom = 1610;
    const pages = [];
    let canvas, ctx, y;
    const font = (size, bold) => { ctx.font = (bold ? '700 ' : '400 ') + size + 'px "Malgun Gothic", "Noto Sans KR", sans-serif'; };
    function newPage() {
      canvas = createCanvas(width, height); canvas.width = width; canvas.height = height;
      ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas is unavailable');
      pages.push(canvas);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = '#449985'; ctx.fillRect(margin, 58, 56, 5);
      font(25, true); ctx.fillStyle = '#276957'; ctx.fillText('iM 파트너', margin, 111);
      font(19, false); ctx.fillStyle = '#798880'; ctx.textAlign = 'right';
      ctx.fillText('생성 데이터 기반 시연 · 규칙 기반 분석', width - margin, 111); ctx.textAlign = 'left';
      y = 177;
    }
    function line(text, size, bold, color, gap) {
      font(size, bold);
      let current = '';
      for (const char of String(text)) {
        if (char === '\n' || (current && ctx.measureText(current + char).width > width - margin * 2)) {
          draw(current); current = char === '\n' ? '' : char;
        } else current += char;
      }
      if (current) draw(current);
      function draw(value) {
        if (y > bottom) { newPage(); font(size, bold); }
        ctx.fillStyle = color || '#334d42'; ctx.fillText(value, margin, y); y += gap || Math.round(size * 1.65);
      }
    }
    function section(title, body) {
      if (y + 150 > bottom) newPage();
      y += 18;
      line(title, 25, true, '#25745e', 44);
      line(body, 23, false, '#415a4f', 37);
    }
    const a = options.analysis, p = options.profile;
    const money = value => Math.round(value).toLocaleString('ko-KR') + '원';
    const pct = value => value == null ? '비교 불가' : (value > 0 ? '+' : '') + value.toFixed(1) + '%';
    newPage();
    line('내 가게 분석 요약', 46, true, '#153e32', 76);
    line(p.name + ' · ' + p.storeName, 24, true);
    line(p.region + ' · ' + p.industry + ' / ' + a.period.start + ' - ' + a.period.end, 22, false, '#75867d');
    line(a.period.comparison, 20, false, '#75867d');
    section('01  매출과 지출', '매출 ' + money(a.sales) + ' (' + pct(a.salesRate) + ')  /  지출 ' + money(a.expense) + ' (' + pct(a.expenseRate) + ')\n매출·지출 차이 ' + money(a.delta) + ' - 영업이익·현금잔액이 아닙니다.');
    section('02  데이터에서 찾은 요인 후보', options.cause);
    section('03  비용 점검', options.cost);
    section('04  다음 실행', a.action + '\n매입금액 상위 품목의 재고·폐기를 확인하고, 같은 요일·시간의 판매 기록을 비교해 보세요.');
    const questions = (options.discussion || []).slice(-3).map(q => String(q).length > 85 ? String(q).slice(0, 85) + '…' : String(q));
    if (questions.length) section('05  요청한 분석 질문', questions.map((q, i) => (i + 1) + '. ' + q.replace(/\s+/g, ' ')).join('\n'));
    section('출처 및 해석 범위', '로컬 생성 POS·지출·매입·상권 비교 자료입니다. 실제 DB·카드사·통신사·외부 AI와 연결되지 않았습니다. 유동인구·카드소비는 각각 시간대 최댓값을 100으로 환산한 상대 지수이며 개인의 구매전환율이 아닙니다. 고객층·방문자·재고·금융 효과·체온계 점수는 근거가 없어 계산하지 않습니다. 프로필 수정은 가상 자료의 대상을 변경하지 않습니다.');
    pages.forEach((page, index) => {
      const c = page.getContext('2d');
      c.strokeStyle = '#dfe9e3'; c.beginPath(); c.moveTo(margin, 1657); c.lineTo(width - margin, 1657); c.stroke();
      c.font = '18px "Malgun Gothic", "Noto Sans KR", sans-serif'; c.fillStyle = '#7b8d83';
      c.fillText('참고용 분석 · 확정 원인·수익 보장·금융 심사 결과가 아닙니다.', margin, 1693);
      c.textAlign = 'right'; c.fillText((index + 1) + ' / ' + pages.length, width - margin, 1693);
    });
    return pages;
  }
  async function generate(options) {
    if (document.fonts && document.fonts.ready) {
      await Promise.race([document.fonts.ready, new Promise(resolve => setTimeout(resolve, 1000))]);
    }
    const canvases = renderCanvases(options, () => document.createElement('canvas'));
    const jpegs = canvases.map(canvas => {
      const data = atob(canvas.toDataURL('image/jpeg', 0.94).split(',')[1]);
      return Uint8Array.from(data, char => char.charCodeAt(0));
    });
    return new Blob([buildPdf(jpegs, 1240, 1754)], { type: 'application/pdf' });
  }
  const api = { generate, renderCanvases, buildPdf };
  root.IM_REPORT_PDF = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
