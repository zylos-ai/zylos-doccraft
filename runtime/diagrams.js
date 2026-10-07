/* Doccraft diagram-only runtime: flow, sequence, and state-machine rendering. */
(function () {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';
  let markerNumber = 0;
  const svg = (tag, attrs = {}, ...children) => {
    const node = document.createElementNS(NS, tag);
    for (const [key, value] of Object.entries(attrs)) if (value !== undefined && value !== null) node.setAttribute(key, value);
    for (const child of children.flat()) if (child !== undefined && child !== null) node.append(child.nodeType ? child : document.createTextNode(child));
    return node;
  };
  const html = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const sourceOf = (host) => host.querySelector(':scope > script[type="text/plain"]')?.textContent.trim() || '';
  const linesOf = (source) => source.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('//'));
  const marker = (root) => {
    const id = `dc-arrow-${++markerNumber}`;
    root.append(svg('defs', {}, svg('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, svg('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'currentColor' }))));
    return id;
  };
  const finish = (host, root, width, caption, scale = true) => {
    host.dataset.doccraftDiagram = '';
    host.querySelectorAll(':scope > :not(script)').forEach((node) => node.remove());
    const frame = html('div', 'dc-frame');
    root.setAttribute('width', width);
    frame.append(root);
    host.prepend(frame);
    if (caption) host.append(html('div', 'dc-caption', caption));
    const fit = () => {
      if (!scale) { root.style.width = `${width}px`; return; }
      const available = Math.max(1, frame.clientWidth - 28);
      root.style.width = `${Math.round(width * Math.min(1, Math.max(0.55, available / width)))}px`;
    };
    fit();
    if (scale && 'ResizeObserver' in window) new ResizeObserver(fit).observe(frame);
  };
  const fail = (host, error) => {
    host.dataset.doccraftDiagram = '';
    host.prepend(html('div', 'dc-error', `${host.tagName.toLowerCase()}: ${error.message}`));
    console.error('[doccraft-diagrams]', error);
  };

  function parseFlow(source) {
    const nodes = new Map(); const edges = []; const grid = [];
    const ensure = (id) => { if (!nodes.has(id)) nodes.set(id, { id, label: id, sub: '', shape: 'box', tone: '' }); return nodes.get(id); };
    for (const line of linesOf(source)) {
      if (line.startsWith('|')) { grid.push(line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()).map((id) => id && id !== '.' ? (ensure(id), id) : null)); continue; }
      let match = line.match(/^(\S+)\s+(-->|->|=>|==>|-x->|\.\.>)\s*(\S+?)(?:\s*:\s*(.*))?$/);
      if (match) { ensure(match[1]); ensure(match[3]); edges.push({ from: match[1], to: match[3], label: match[4] || '', dashed: match[2] === '-->' || match[2] === '..>', lost: match[2] === '-x->' }); continue; }
      match = line.match(/^([\w.-]+)\s*=\s*(.*)$/);
      if (match) {
        const node = ensure(match[1]); let body = match[2]; const attr = body.match(/\[([^\]]*)\]\s*$/);
        if (attr) { body = body.slice(0, attr.index).trim(); for (const token of attr[1].split(/[\s,]+/)) { if (['box', 'pill', 'diamond', 'db', 'circle'].includes(token)) node.shape = token; else if (token) node.tone = token; } }
        const parts = body.split(/\s+\/\s+/); node.label = parts[0] || node.id; node.sub = parts.slice(1).join(' / '); continue;
      }
      if (!/^[\w.-]+$/.test(line)) throw new Error(`could not parse "${line}"`);
      ensure(line);
    }
    if (!nodes.size) throw new Error('no nodes');
    return { nodes, edges, grid };
  }

  function flowShape(node, x, y, width, height) {
    const attrs = { class: `dc-node ${node.tone}`.trim() };
    if (node.shape === 'pill') return svg('rect', { ...attrs, x, y, width, height, rx: height / 2 });
    if (node.shape === 'circle') return svg('ellipse', { ...attrs, cx: x + width / 2, cy: y + height / 2, rx: height / 2, ry: height / 2 });
    if (node.shape === 'diamond') return svg('path', { ...attrs, d: `M${x + width / 2},${y} L${x + width},${y + height / 2} L${x + width / 2},${y + height} L${x},${y + height / 2} Z` });
    if (node.shape === 'db') return svg('path', { ...attrs, d: `M${x},${y + 7} A${width / 2},7 0 0 1 ${x + width},${y + 7} L${x + width},${y + height - 7} A${width / 2},7 0 0 1 ${x},${y + height - 7} Z M${x},${y + 7} A${width / 2},7 0 0 0 ${x + width},${y + 7}` });
    return svg('rect', { ...attrs, x, y, width, height, rx: 8 });
  }

  function renderFlow(host) {
    const model = parseFlow(sourceOf(host)); const ids = [...model.nodes.keys()];
    const rows = model.grid.length ? model.grid : ids.map((id) => [id]);
    const cols = Math.max(...rows.map((row) => row.length)); const cellW = 174, cellH = 104, pad = 28, nodeW = 132, nodeH = 54;
    const width = pad * 2 + cols * cellW; const height = pad * 2 + rows.length * cellH;
    const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, height, role: 'img', 'aria-label': host.getAttribute('caption') || 'Flow diagram' });
    const arrow = marker(root); const positions = new Map();
    rows.forEach((row, r) => row.forEach((id, c) => { if (id) positions.set(id, { x: pad + c * cellW + (cellW - nodeW) / 2, y: pad + r * cellH + (cellH - nodeH) / 2 }); }));
    ids.filter((id) => !positions.has(id)).forEach((id, index) => positions.set(id, { x: pad, y: pad + (rows.length + index) * cellH }));
    for (const edge of model.edges) {
      const a = positions.get(edge.from), b = positions.get(edge.to); const x1 = a.x + nodeW / 2, y1 = a.y + nodeH / 2, x2 = b.x + nodeW / 2, y2 = b.y + nodeH / 2;
      const group = svg('g'); group.append(svg('path', { class: `dc-edge${edge.dashed ? ' dashed' : ''}${edge.lost ? ' lost' : ''}`, d: `M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}`, 'marker-end': `url(#${arrow})` }));
      if (edge.label) { const cx = (x1 + x2) / 2, cy = (y1 + y2) / 2; group.append(svg('rect', { class: 'dc-label-bg', x: cx - edge.label.length * 3.5 - 5, y: cy - 10, width: edge.label.length * 7 + 10, height: 18, rx: 4 }), svg('text', { x: cx, y: cy + 3, 'text-anchor': 'middle' }, edge.label)); }
      root.append(group);
    }
    for (const [id, node] of model.nodes) { const p = positions.get(id); root.append(flowShape(node, p.x, p.y, nodeW, nodeH), svg('text', { x: p.x + nodeW / 2, y: p.y + (node.sub ? 23 : 31), 'text-anchor': 'middle', 'font-weight': 600 }, node.label)); if (node.sub) root.append(svg('text', { class: 'dc-sub', x: p.x + nodeW / 2, y: p.y + 40, 'text-anchor': 'middle' }, node.sub)); }
    finish(host, root, width, host.getAttribute('caption'));
  }

  function parseSequence(source) {
    const actors = []; const seen = new Set(); const steps = [];
    const actor = (id) => { if (!seen.has(id)) { seen.add(id); actors.push(id); } };
    for (const line of linesOf(source)) {
      let match = line.match(/^note\s+(?:over|on)\s+([\w.,\s-]+?)\s*:\s*(.+)$/i);
      if (match) { const over = match[1].split(/[\s,]+/).filter(Boolean); over.forEach(actor); steps.push({ kind: 'note', over, text: match[2] }); continue; }
      match = line.match(/^(\S+)\s+(-->|->|-x->|\.\.>)\s*(\S+?)(?:\s*:\s*(.*))?$/);
      if (!match) throw new Error(`could not parse "${line}"`);
      actor(match[1]); actor(match[3]); steps.push({ kind: 'message', from: match[1], to: match[3], text: match[4] || '', dashed: match[2] !== '->', lost: match[2] === '-x->' });
    }
    if (!steps.length) throw new Error('no messages');
    return { actors, steps };
  }

  function renderSequence(host) {
    const model = parseSequence(sourceOf(host)); const col = 126, pad = 24, top = 18, actorH = 36, rowH = 48;
    const width = pad * 2 + model.actors.length * col; const height = top + actorH + 24 + model.steps.length * rowH + 22;
    const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, height, role: 'img', 'aria-label': host.getAttribute('caption') || 'Sequence diagram' }); const arrow = marker(root);
    const x = (id) => pad + model.actors.indexOf(id) * col + col / 2;
    model.actors.forEach((actor) => { const cx = x(actor); root.append(svg('line', { class: 'dc-life', x1: cx, x2: cx, y1: top + actorH, y2: height - 12 }), svg('rect', { class: 'dc-actor', x: cx - 48, y: top, width: 96, height: actorH, rx: 6 }), svg('text', { class: 'dc-actor-label', x: cx, y: top + 23, 'text-anchor': 'middle' }, actor)); });
    let y = top + actorH + 32;
    model.steps.forEach((step) => {
      if (step.kind === 'note') { const xs = step.over.map(x), cx = (Math.min(...xs) + Math.max(...xs)) / 2, width = Math.max(120, Math.min(220, step.text.length * 7 + 20)); root.append(svg('rect', { class: 'dc-note', x: cx - width / 2, y: y - 17, width, height: 30, rx: 4 }), svg('text', { x: cx, y: y + 3, 'text-anchor': 'middle' }, step.text)); y += rowH; return; }
      const x1 = x(step.from), x2 = x(step.to); root.append(svg('text', { x: (x1 + x2) / 2, y: y - 9, 'text-anchor': 'middle' }, step.text), svg('path', { class: `dc-edge${step.dashed ? ' dashed' : ''}${step.lost ? ' lost' : ''}`, d: `M${x1},${y} L${x2 + (x2 > x1 ? -2 : 2)},${y}`, 'marker-end': `url(#${arrow})` })); if (step.lost) root.append(svg('text', { x: x2, y: y + 4, fill: 'var(--dc-bad)', 'font-weight': 700 }, 'x')); y += rowH;
    });
    finish(host, root, width, host.getAttribute('caption'), false);
  }

  function parseMachine(source) {
    const states = new Map(); const events = []; const grid = []; let initial = '';
    const ensure = (id) => { if (!states.has(id)) states.set(id, { id, label: id, final: false }); return states.get(id); };
    for (const line of linesOf(source)) {
      let match;
      if (line.startsWith('|')) { grid.push(line.replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim()).map((id) => id && id !== '.' ? (ensure(id), id) : null)); continue; }
      if ((match = line.match(/^machine\s+[\w.-]+(?:\s+initial\s+([\w.-]+))?$/i))) { if (match[1]) initial = match[1]; continue; }
      if ((match = line.match(/^state\s+([\w.-]+)(?:\s+"([^"]*)")?(?:\s+(.*))?$/i))) {
        const state = ensure(match[1]); const remainder = (match[3] || '').trim(); const hash = remainder.indexOf('#');
        const flags = (hash >= 0 ? remainder.slice(0, hash) : remainder).trim(); const comment = hash >= 0 ? remainder.slice(hash + 1).trim() : '';
        state.label = match[2] || comment || state.id; state.final = /\bfinal\b/i.test(flags); if (/\binitial\b/i.test(flags)) initial = state.id; continue;
      }
      if ((match = line.match(/^([\w.-]+)\s+-\s*([\w.-]+)\s*->\s+([\w.-]+)\s*(?::\s*(.*))?$/))) { ensure(match[1]); ensure(match[3]); events.push({ from: match[1], to: match[3], label: match[4] || match[2] }); continue; }
      throw new Error(`could not parse "${line}"`);
    }
    if (!states.size) throw new Error('no states'); if (!initial) initial = states.keys().next().value;
    return { states, events, grid, initial };
  }

  function renderMachine(host) {
    const model = parseMachine(sourceOf(host)); const ids = [...model.states.keys()]; const rows = model.grid.length ? model.grid : ids.map((id) => [id]);
    const cols = Math.max(...rows.map((row) => row.length)); const cellW = 170, cellH = 94, pad = 30, nodeW = 126, nodeH = 42;
    const width = pad * 2 + cols * cellW, height = pad * 2 + rows.length * cellH; const root = svg('svg', { viewBox: `0 0 ${width} ${height}`, height, role: 'img', 'aria-label': host.getAttribute('caption') || 'State machine' }); const arrow = marker(root); const positions = new Map();
    rows.forEach((row, r) => row.forEach((id, c) => { if (id) positions.set(id, { x: pad + c * cellW + (cellW - nodeW) / 2, y: pad + r * cellH + (cellH - nodeH) / 2 }); }));
    for (const event of model.events) { const a = positions.get(event.from), b = positions.get(event.to); const x1 = a.x + nodeW / 2, y1 = a.y + nodeH / 2, x2 = b.x + nodeW / 2, y2 = b.y + nodeH / 2, cx = (x1 + x2) / 2, cy = (y1 + y2) / 2; root.append(svg('path', { class: 'dc-edge', d: `M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`, 'marker-end': `url(#${arrow})` }), svg('rect', { class: 'dc-label-bg', x: cx - event.label.length * 3.5 - 5, y: cy - 10, width: event.label.length * 7 + 10, height: 18, rx: 4 }), svg('text', { x: cx, y: cy + 3, 'text-anchor': 'middle' }, event.label)); }
    for (const [id, state] of model.states) { const p = positions.get(id); root.append(svg('rect', { class: `dc-state${id === model.initial ? ' initial' : ''}${state.final ? ' final' : ''}`, x: p.x, y: p.y, width: nodeW, height: nodeH, rx: nodeH / 2 }), svg('text', { x: p.x + nodeW / 2, y: p.y + 26, 'text-anchor': 'middle', 'font-weight': 600 }, state.label)); }
    finish(host, root, width, host.getAttribute('caption'));
  }

  function boot() {
    const renderers = { 'doc-flow': renderFlow, 'doc-seq': renderSequence, 'doc-machine': renderMachine };
    for (const [tag, render] of Object.entries(renderers)) for (const host of document.querySelectorAll(tag)) { if (host.dataset.doccraftDiagram !== undefined) continue; try { render(host); } catch (error) { fail(host, error); } }
    document.documentElement.dataset.doccraftDiagramsReady = '1';
    document.documentElement.dataset.nwReady = '1';
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true }); else boot();
}());
