/* Diagram-only isolation for the pinned html-plan renderer. */
(function () {
  'use strict';
  const outerDocument = document;
  /* UPSTREAM_CSS */
  const themeCss = `
    :host { display:block; max-width:100%; margin:18px 0 24px;
      --card:var(--surface,#fff); --bg:var(--surface,#fff);
      --ink-2:var(--ink2,#5c6270); --ink-3:var(--ink2,#5c6270);
      --line:var(--hairline,#dfe3e1); --line-2:var(--hairline,#dfe3e1);
      --green:var(--settled,#2e7d46); --red:var(--threat,#b3423a); --amber:var(--converge,#a96f14);
      --r:8px;
      --paper:var(--surface,#fff); --green-soft:var(--settled-soft,var(--card));
      --red-soft:var(--threat-soft,var(--card)); --amber-soft:var(--converge-soft,var(--card));
      --blue:#2466a3; --blue-soft:var(--card); --purple:#7959a3; --purple-soft:var(--card); --sunk:var(--surface2,var(--card));
      --sans:-apple-system,BlinkMacSystemFont,"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif;
      --mono:ui-monospace,monospace; }
    doc-flow,doc-seq,doc-machine { max-width:100%; margin:0; }
    .fig-frame,.mc-fig { overflow:auto; max-width:100%; overscroll-behavior-inline:contain; }
    svg { height:auto; max-width:none; }
    svg.nw.machine .tr text { font:12px var(--mono); }
    .fig-zoom { display:none; }
    .has-detail { cursor:default; }
    dialog { max-width:min(90vw,600px); color:var(--ink); background:var(--card); border:1px solid var(--line); border-radius:8px; }
  `;
  function renderHost(host) {
    const shadow = host.attachShadow({ mode: 'open' });
    const style = outerDocument.createElement('style'); style.textContent = upstreamCss + themeCss;
    const el = outerDocument.createElement(host.tagName.toLowerCase());
    for (const attr of host.attributes) el.setAttribute(attr.name, attr.value);
    el.append(...[...host.childNodes].map((node) => node.cloneNode(true)));
    shadow.append(style, el);
    const document = {
      createElement: outerDocument.createElement.bind(outerDocument),
      createElementNS: outerDocument.createElementNS.bind(outerDocument),
      createTextNode: outerDocument.createTextNode.bind(outerDocument),
      querySelector: shadow.querySelector.bind(shadow),
      querySelectorAll: shadow.querySelectorAll.bind(shadow),
    };
    const defs = [], machines = {}, S = { comments: {} };
    const canvas = outerDocument.createElement('canvas'), context = canvas.getContext('2d');
    const measure = (text, mono = false, weight = 400) => {
      const family = getComputedStyle(host).getPropertyValue(mono ? '--mono' : '--sans').trim()
        || (mono ? 'ui-monospace,monospace' : '-apple-system,BlinkMacSystemFont,"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif');
      context.font = `${weight} 12px ${family}`; return context.measureText(String(text)).width;
    };
    const define = (tag, renderer) => defs.push([tag, renderer]);
    const secLabel = () => '', onFormChange = () => {}, commentable = () => {}, upgradeWithin = () => {};
    let pop = null;
    const closePop = () => { pop?.remove(); pop = null; };
    const openComment = ({ extra }) => {
      if (!extra) return;
      closePop(); pop = outerDocument.createElement('dialog');
      const close = outerDocument.createElement('button'); close.textContent = 'Close'; close.addEventListener('click', closePop);
      pop.append(extra, close); shadow.append(pop); pop.showModal();
    };
    const openSheet = () => {};
    function errBox(_, errors, tag) { if (errors.length) throw new Error(`${tag}: ${errors.join('\n')}`); }
    /* UPSTREAM_RUNTIME */
    const correctLabels = () => {
      for (const group of shadow.querySelectorAll('g.edge, g.tr, g.snote')) {
        const background = group.querySelector('rect.lbl, :scope > rect');
        const texts = [...group.querySelectorAll(':scope > text')];
        if (!background || !texts.length) continue;
        const boxes = texts.map((text) => text.getBBox());
        const left = Math.min(...boxes.map((b) => b.x)), top = Math.min(...boxes.map((b) => b.y));
        const right = Math.max(...boxes.map((b) => b.x + b.width)), bottom = Math.max(...boxes.map((b) => b.y + b.height));
        background.setAttribute('x', left - 5); background.setAttribute('y', top - 3);
        background.setAttribute('width', right - left + 10); background.setAttribute('height', bottom - top + 6);
      }
      for (const svg of shadow.querySelectorAll('svg.nw')) {
        const old = svg.viewBox.baseVal, bounds = svg.getBBox();
        const left = Math.min(0, bounds.x - 8), top = Math.min(0, bounds.y - 8);
        const width = Math.max(old.x + old.width, bounds.x + bounds.width + 8) - left;
        const height = Math.max(old.y + old.height, bounds.y + bounds.height + 8) - top;
        svg.setAttribute('viewBox', `${left} ${top} ${width} ${height}`);
        svg.setAttribute('width', width); svg.setAttribute('height', height); svg.style.width = `${width}px`;
      }
    };
    defs.find(([tag]) => tag === host.tagName.toLowerCase())[1](el);
    host.replaceChildren(); host.dataset.doccraftDiagram = '';
    const observer = new MutationObserver(() => { observer.disconnect(); correctLabels(); observer.observe(el, { childList:true, subtree:true }); });
    observer.observe(el, { childList:true, subtree:true });
    correctLabels();
    new ResizeObserver(() => requestAnimationFrame(correctLabels)).observe(host);
  }
  function boot() {
    for (const host of outerDocument.querySelectorAll('doc-flow,doc-seq,doc-machine')) {
      if (host.dataset.doccraftDiagram !== undefined) continue;
      try { renderHost(host); } catch (error) {
        const box = outerDocument.createElement('pre'); box.className = 'dc-error'; box.textContent = error.message;
        (host.shadowRoot || host).append(box); host.dataset.doccraftDiagram = 'error';
        console.error('[doccraft-diagrams]', error);
      }
    }
    outerDocument.documentElement.dataset.doccraftDiagramsReady = '1';
    outerDocument.documentElement.dataset.nwReady = '1';
  }
  if (outerDocument.readyState === 'loading') outerDocument.addEventListener('DOMContentLoaded', boot, { once:true }); else boot();
}());
