/* ================================================================
   GRAMMAR AMBIGUITY DETECTOR & VISUALIZER — CORE LOGIC
   Modular JavaScript: grammar parsing, parse tree generation,
   ambiguity detection, SVG rendering, derivation extraction.
   ================================================================ */

// ==========================================
// CONSTANTS & CONFIGURATION
// ==========================================
const MAX_DEPTH = 30;
const MAX_TREES_SEARCH = 15;
const MAX_UNIQUE_TREES = 5;

const NODE_RADIUS = 28;
const LEAF_SPACING = 90;
const LEVEL_HEIGHT = 95;
const TREE_PADDING_X = 55;
const TREE_PADDING_Y = 45;

const SVG_NS = 'http://www.w3.org/2000/svg';

// ==========================================
// PREDEFINED EXAMPLES
// ==========================================
const EXAMPLES = [
    {
        name: '❌ Ambiguous Expression',
        grammar: 'E -> E + E | E * E | id',
        input: 'id + id * id',
        cssClass: 'ambiguous',
        description: 'Classic ambiguous arithmetic expression grammar'
    },
    {
        name: '✅ Balanced Strings',
        grammar: 'S -> a S b | a b',
        input: 'a a b b',
        cssClass: 'not-ambiguous',
        description: 'Generates balanced strings — not ambiguous'
    },
    {
        name: '✅ Unambiguous Expression',
        grammar: 'E -> E + T | T\nT -> T * F | F\nF -> ( E ) | id',
        input: 'id + id * id',
        cssClass: 'not-ambiguous',
        description: 'Standard unambiguous expression grammar with operator precedence'
    },
    {
        name: '❌ Ambiguous Addition',
        grammar: 'S -> S + S | a',
        input: 'a + a + a',
        cssClass: 'ambiguous',
        description: 'Simplest ambiguous grammar demonstrating associativity ambiguity'
    }
];

// ==========================================
// APPLICATION STATE
// ==========================================
let currentGrammar = null;
let currentTrees = [];
let currentDerivationType = 'leftmost';

// ==========================================
// GRAMMAR PARSING
// ==========================================

/**
 * Parse a grammar text into a structured representation.
 * Format: "A -> X Y Z | W V" (space-separated symbols, | for alternatives)
 * @param {string} text - Raw grammar text
 * @returns {{ rules: Object, nonTerminals: Set, terminals: Set, startSymbol: string }}
 */
function parseGrammar(text) {
    const rules = {};
    const nonTerminals = new Set();
    const terminals = new Set();
    const lines = text.trim().split('\n').filter(l => l.trim().length > 0);

    if (lines.length === 0) {
        throw new Error('Grammar is empty. Please enter at least one production rule.');
    }

    // First pass: collect all non-terminal names (LHS of rules)
    for (const line of lines) {
        const arrowIdx = line.indexOf('->');
        if (arrowIdx === -1) {
            throw new Error(`Invalid rule format: "${line.trim()}". Use -> for production arrows.`);
        }
        const lhs = line.substring(0, arrowIdx).trim();
        if (!lhs) {
            throw new Error(`Missing left-hand side in rule: "${line.trim()}"`);
        }
        nonTerminals.add(lhs);
    }

    // Second pass: parse all productions
    for (const line of lines) {
        const arrowIdx = line.indexOf('->');
        const lhs = line.substring(0, arrowIdx).trim();
        const rhs = line.substring(arrowIdx + 2).trim();

        if (!rhs) {
            throw new Error(`Missing right-hand side in rule: "${line.trim()}"`);
        }

        const alternatives = rhs.split('|');

        if (!rules[lhs]) rules[lhs] = [];

        for (const alt of alternatives) {
            const trimmed = alt.trim();
            if (!trimmed) continue;

            const symbols = trimmed.split(/\s+/).filter(s => s.length > 0);
            rules[lhs].push(symbols);

            // Collect terminals
            for (const sym of symbols) {
                if (!nonTerminals.has(sym)) {
                    terminals.add(sym);
                }
            }
        }
    }

    // Validate: ensure every non-terminal used on RHS has at least one production
    // (except terminals which are fine)
    for (const prods of Object.values(rules)) {
        for (const prod of prods) {
            for (const sym of prod) {
                if (!nonTerminals.has(sym) && !terminals.has(sym)) {
                    terminals.add(sym);
                }
            }
        }
    }

    const startSymbol = lines[0].substring(0, lines[0].indexOf('->')).trim();

    return { rules, nonTerminals, terminals, startSymbol };
}

// ==========================================
// INPUT TOKENIZATION
// ==========================================

/**
 * Tokenize an input string using space-separated tokens.
 * @param {string} input - Raw input string
 * @param {Set} terminals - Set of terminal symbols from the grammar
 * @returns {string[]} Array of tokens
 */
function tokenizeInput(input, terminals) {
    const tokens = input.trim().split(/\s+/).filter(t => t.length > 0);

    if (tokens.length === 0) {
        throw new Error('Input string is empty. Please enter a string to parse.');
    }

    // Validate all tokens are terminals in the grammar
    for (const token of tokens) {
        if (!terminals.has(token)) {
            throw new Error(`Unknown token "${token}" — not a terminal in the grammar. Terminals: {${[...terminals].join(', ')}}`);
        }
    }

    return tokens;
}

// ==========================================
// PARSE TREE GENERATION (Recursive Descent with Backtracking)
// ==========================================

/**
 * Generate all possible parse trees for a given grammar and token sequence.
 * Uses recursive descent with backtracking and depth limiting.
 * @param {Object} grammar - Parsed grammar object
 * @param {string[]} tokens - Array of input tokens
 * @returns {Object[]} Array of parse tree roots
 */
function generateParseTrees(grammar, tokens) {
    const memo = new Map();
    const trees = findAllParses(grammar, grammar.startSymbol, tokens, 0, tokens.length, 0, MAX_DEPTH, memo);
    return getUniqueTrees(trees).slice(0, MAX_UNIQUE_TREES);
}

/**
 * Find all possible parses for a symbol over a span of tokens.
 * @returns {Object[]} Array of parse tree nodes
 */
function findAllParses(grammar, symbol, tokens, start, end, depth, maxDepth, memo) {
    if (depth > maxDepth) return [];
    if (start > end) return [];
    if (start === end) return [];  // Non-empty symbol needs at least one token

    // Memoization key
    const key = `${symbol}:${start}:${end}`;
    if (memo.has(key)) return memo.get(key);

    // Set to empty initially to prevent infinite loops (left-recursion guard)
    memo.set(key, []);

    const results = [];

    if (grammar.terminals.has(symbol)) {
        // Terminal: must match exactly one token
        if (end - start === 1 && tokens[start] === symbol) {
            results.push({
                label: symbol,
                children: [],
                isTerminal: true
            });
        }
    } else {
        // Non-terminal: try each production rule
        const productions = grammar.rules[symbol];
        if (!productions) return results;

        for (const prod of productions) {
            if (results.length >= MAX_TREES_SEARCH) break;

            const matches = matchSequence(grammar, prod, tokens, start, end, depth + 1, maxDepth, MAX_TREES_SEARCH - results.length, memo);
            for (const children of matches) {
                if (results.length >= MAX_TREES_SEARCH) break;
                results.push({
                    label: symbol,
                    children: children,
                    isTerminal: false
                });
            }
        }
    }

    memo.set(key, results);
    return results;
}

/**
 * Try to match a sequence of grammar symbols against a span of tokens.
 * Returns all possible ways to split the tokens among the symbols.
 * @returns {Object[][]} Array of arrays of parse tree nodes (each inner array is one way to match)
 */
function matchSequence(grammar, sequence, tokens, start, end, depth, maxDepth, maxResults, memo) {
    if (sequence.length === 0) {
        return start === end ? [[]] : [];
    }

    if (depth > maxDepth) return [];

    const first = sequence[0];
    const rest = sequence.slice(1);
    const results = [];

    if (grammar.terminals.has(first)) {
        // Terminal: must match exactly one token at 'start'
        if (start < end && tokens[start] === first) {
            const restMatches = matchSequence(grammar, rest, tokens, start + 1, end, depth, maxDepth, maxResults, memo);
            for (const rm of restMatches) {
                if (results.length >= maxResults) break;
                results.push([
                    { label: first, children: [], isTerminal: true },
                    ...rm
                ]);
            }
        }
    } else {
        // Non-terminal: try all possible spans
        // Each symbol in 'rest' needs at least 1 token
        const minForRest = rest.length;
        const maxMid = end - minForRest;

        for (let mid = start + 1; mid <= maxMid; mid++) {
            if (results.length >= maxResults) break;

            const firstTrees = findAllParses(grammar, first, tokens, start, mid, depth, maxDepth, memo);
            if (firstTrees.length === 0) continue;

            const restMatches = matchSequence(grammar, rest, tokens, mid, end, depth, maxDepth, maxResults - results.length, memo);
            if (restMatches.length === 0) continue;

            for (const ft of firstTrees) {
                for (const rm of restMatches) {
                    if (results.length >= maxResults) break;
                    results.push([ft, ...rm]);
                }
            }
        }
    }

    return results;
}

// ==========================================
// TREE COMPARISON
// ==========================================

/**
 * Check if two parse trees are structurally identical.
 */
function areTreesEqual(t1, t2) {
    if (t1.label !== t2.label) return false;
    if (t1.children.length !== t2.children.length) return false;
    for (let i = 0; i < t1.children.length; i++) {
        if (!areTreesEqual(t1.children[i], t2.children[i])) return false;
    }
    return true;
}

/**
 * Filter to keep only structurally unique trees.
 */
function getUniqueTrees(trees) {
    const unique = [];
    for (const tree of trees) {
        let isDuplicate = false;
        for (const u of unique) {
            if (areTreesEqual(tree, u)) {
                isDuplicate = true;
                break;
            }
        }
        if (!isDuplicate) unique.push(tree);
    }
    return unique;
}

// ==========================================
// DERIVATION GENERATION
// ==========================================

/**
 * Extract a step-by-step derivation from a parse tree.
 * @param {Object} tree - Parse tree root
 * @param {'leftmost'|'rightmost'} type - Derivation type
 * @returns {Object[]} Array of derivation steps
 */
function getDerivation(tree, type) {
    const steps = [];

    // Each element in sentential form tracks { symbol, node, isTerminal }
    let form = [{ symbol: tree.label, node: tree, isTerminal: tree.isTerminal }];

    steps.push({
        symbols: form.map(f => ({
            text: f.symbol,
            isTerminal: f.isTerminal,
            isHighlighted: false
        })),
        rule: null
    });

    let iteration = 0;
    const maxIterations = 200;

    while (iteration++ < maxIterations) {
        // Find the next non-terminal to expand
        let idx = -1;
        if (type === 'leftmost') {
            for (let i = 0; i < form.length; i++) {
                if (!form[i].isTerminal && form[i].node && form[i].node.children.length > 0) {
                    idx = i;
                    break;
                }
            }
        } else {
            for (let i = form.length - 1; i >= 0; i--) {
                if (!form[i].isTerminal && form[i].node && form[i].node.children.length > 0) {
                    idx = i;
                    break;
                }
            }
        }

        if (idx === -1) break;

        const node = form[idx].node;
        const replacement = node.children.map(c => ({
            symbol: c.label,
            node: c,
            isTerminal: c.isTerminal || c.children.length === 0
        }));

        const ruleStr = `${node.label} → ${node.children.map(c => c.label).join(' ')}`;

        form = [
            ...form.slice(0, idx),
            ...replacement,
            ...form.slice(idx + 1)
        ];

        // Build the step with highlights on newly added symbols
        const highlightStart = idx;
        const highlightEnd = idx + replacement.length;

        steps.push({
            symbols: form.map((f, i) => ({
                text: f.symbol,
                isTerminal: f.isTerminal,
                isHighlighted: i >= highlightStart && i < highlightEnd
            })),
            rule: ruleStr
        });
    }

    return steps;
}

// ==========================================
// TREE LAYOUT ENGINE
// ==========================================

/**
 * Calculate positions for all nodes in a tree (bottom-up, leaves first).
 * @param {Object} tree - Parse tree root
 * @returns {{ width: number, height: number, maxDepth: number }}
 */
function layoutTree(tree) {
    let leafIndex = 0;
    let maxDepth = 0;

    function assign(node, depth) {
        node.depth = depth;
        if (depth > maxDepth) maxDepth = depth;

        if (node.children.length === 0) {
            node.x = leafIndex * LEAF_SPACING;
            node.y = depth * LEVEL_HEIGHT;
            leafIndex++;
        } else {
            for (const child of node.children) {
                assign(child, depth + 1);
            }
            // Center parent above its children
            const firstChild = node.children[0];
            const lastChild = node.children[node.children.length - 1];
            node.x = (firstChild.x + lastChild.x) / 2;
            node.y = depth * LEVEL_HEIGHT;
        }
    }

    assign(tree, 0);

    return {
        width: Math.max(leafIndex * LEAF_SPACING, 100),
        height: (maxDepth + 1) * LEVEL_HEIGHT,
        maxDepth
    };
}

// ==========================================
// SVG TREE RENDERING
// ==========================================

/**
 * Create an SVG element with attributes.
 */
function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(SVG_NS, tag);
    for (const [key, val] of Object.entries(attrs)) {
        el.setAttribute(key, val);
    }
    return el;
}

/**
 * Render a parse tree as SVG and append to a container.
 * @param {Object} tree - Parse tree root with layout info (x, y)
 * @param {HTMLElement} container - DOM container for the SVG
 * @param {Set} nonTerminals - Set of non-terminal symbols
 * @param {number} treeIndex - Index of the tree (for color variations)
 */
function renderTree(tree, container, nonTerminals, treeIndex) {
    const layout = layoutTree(tree);

    const svgWidth = layout.width + TREE_PADDING_X * 2;
    const svgHeight = layout.height + TREE_PADDING_Y * 2;

    const svg = svgEl('svg', {
        width: Math.min(svgWidth, 900),
        height: svgHeight,
        viewBox: `0 0 ${svgWidth} ${svgHeight}`,
        style: 'overflow: visible; display: block;'
    });

    // Color palettes per tree index
    const palettes = [
        { ntFill: '#3b2f7a', ntStroke: '#a78bfa', ntText: '#ffffff', tFill: '#0e4a3a', tStroke: '#34d399', tText: '#6ee7b7', edge: 'rgba(167,139,250,0.45)', glowNT: 'rgba(167,139,250,0.2)', glowT: 'rgba(52,211,153,0.18)' },
        { ntFill: '#1e3a5f', ntStroke: '#38bdf8', ntText: '#ffffff', tFill: '#3a2520', tStroke: '#fb923c', tText: '#fdba74', edge: 'rgba(56,189,248,0.4)', glowNT: 'rgba(56,189,248,0.2)', glowT: 'rgba(251,146,60,0.18)' },
        { ntFill: '#4a2040', ntStroke: '#f472b6', ntText: '#ffffff', tFill: '#2a3a1a', tStroke: '#a3e635', tText: '#bef264', edge: 'rgba(244,114,182,0.4)', glowNT: 'rgba(244,114,182,0.2)', glowT: 'rgba(163,230,53,0.18)' }
    ];
    const pal = palettes[treeIndex % palettes.length];

    // Draw edges first (behind nodes)
    drawEdges(tree, svg, TREE_PADDING_X, TREE_PADDING_Y, pal);

    // Draw nodes on top
    drawNodes(tree, svg, nonTerminals, TREE_PADDING_X, TREE_PADDING_Y, pal);

    container.innerHTML = '';
    container.appendChild(svg);
}

/**
 * Recursively draw edges — smooth lines with inline styles.
 */
function drawEdges(node, svg, ox, oy, pal) {
    for (const child of node.children) {
        const x1 = node.x + ox;
        const y1 = node.y + oy + NODE_RADIUS;
        const x2 = child.x + ox;
        const y2 = child.y + oy - NODE_RADIUS;

        // Bezier curve for smooth connections
        const midY = (y1 + y2) / 2;
        const path = svgEl('path', {
            d: `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`,
            fill: 'none',
            stroke: pal.edge,
            'stroke-width': '2.5',
            'stroke-linecap': 'round'
        });

        svg.appendChild(path);
        drawEdges(child, svg, ox, oy, pal);
    }
}

/**
 * Recursively draw nodes — solid filled circles with inline styles.
 */
function drawNodes(node, svg, nonTerminals, ox, oy, pal) {
    const isNT = nonTerminals.has(node.label);
    const cx = node.x + ox;
    const cy = node.y + oy;

    const g = svgEl('g', {
        transform: `translate(${cx}, ${cy})`,
        style: 'cursor: pointer;'
    });

    // Outer glow ring
    const glowRing = svgEl('circle', {
        r: NODE_RADIUS + 5,
        cx: 0, cy: 0,
        fill: 'none',
        stroke: isNT ? pal.glowNT : pal.glowT,
        'stroke-width': '1.5'
    });

    // Main node circle — INLINE STYLES to guarantee visibility
    const circle = svgEl('circle', {
        r: NODE_RADIUS,
        cx: 0, cy: 0,
        fill: isNT ? pal.ntFill : pal.tFill,
        stroke: isNT ? pal.ntStroke : pal.tStroke,
        'stroke-width': isNT ? '3' : '2.5'
    });

    // Label text — bold, bright, readable
    const text = svgEl('text', {
        x: 0, y: 1,
        fill: isNT ? pal.ntText : pal.tText,
        'font-family': "'JetBrains Mono', 'Consolas', monospace",
        'font-size': '15',
        'font-weight': '700',
        'text-anchor': 'middle',
        'dominant-baseline': 'central',
        style: 'pointer-events: none;'
    });
    text.textContent = node.label;

    g.appendChild(glowRing);
    g.appendChild(circle);
    g.appendChild(text);
    svg.appendChild(g);

    for (const child of node.children) {
        drawNodes(child, svg, nonTerminals, ox, oy, pal);
    }
}

// ==========================================
// DERIVATION RENDERING
// ==========================================

/**
 * Render derivation steps as styled HTML.
 * @param {Object[]} steps - Array of derivation steps
 * @param {HTMLElement} container - DOM container
 * @param {Set} nonTerminals - Set of non-terminal symbols
 */
function renderDerivation(steps, container, nonTerminals) {
    container.innerHTML = '';
    const stepsDiv = document.createElement('div');
    stepsDiv.className = 'derivation-steps';

    steps.forEach((step, i) => {
        const stepDiv = document.createElement('div');
        stepDiv.className = 'deriv-step';
        stepDiv.style.animationDelay = `${i * 50}ms`;

        // Arrow
        const arrowSpan = document.createElement('span');
        arrowSpan.className = 'step-arrow';
        arrowSpan.textContent = i === 0 ? '  ' : '⇒';

        // Form
        const formSpan = document.createElement('span');
        formSpan.className = 'step-form';

        step.symbols.forEach((sym, j) => {
            const symSpan = document.createElement('span');
            symSpan.className = 'sym';

            if (sym.isHighlighted) {
                symSpan.classList.add('highlight');
            }
            if (sym.isTerminal || !nonTerminals.has(sym.text)) {
                symSpan.classList.add('terminal');
            } else {
                symSpan.classList.add('nonterminal');
            }

            symSpan.textContent = sym.text;
            formSpan.appendChild(symSpan);

            // Add space between symbols
            if (j < step.symbols.length - 1) {
                formSpan.appendChild(document.createTextNode(' '));
            }
        });

        // Rule used
        const ruleSpan = document.createElement('span');
        ruleSpan.className = 'step-rule';
        ruleSpan.textContent = step.rule ? `[${step.rule}]` : '';

        stepDiv.appendChild(arrowSpan);
        stepDiv.appendChild(formSpan);
        stepDiv.appendChild(ruleSpan);
        stepsDiv.appendChild(stepDiv);
    });

    container.appendChild(stepsDiv);
}

// ==========================================
// UI LOGIC
// ==========================================

/**
 * Main analysis function — called when user clicks "Analyze Grammar".
 */
function analyze() {
    const grammarText = document.getElementById('grammarInput').value.trim();
    const stringText = document.getElementById('stringInput').value.trim();

    // Reset output
    clearResults();

    if (!grammarText) {
        showResult('error', '⚠️', 'Missing Grammar', 'Please enter grammar production rules before analyzing.');
        return;
    }

    if (!stringText) {
        showResult('error', '⚠️', 'Missing Input String', 'Please enter a string to parse against the grammar.');
        return;
    }

    // Parse grammar
    let grammar;
    try {
        grammar = parseGrammar(grammarText);
        currentGrammar = grammar;
    } catch (e) {
        showResult('error', '⚠️', 'Grammar Error', e.message);
        return;
    }

    // Tokenize input
    let tokens;
    try {
        tokens = tokenizeInput(stringText, grammar.terminals);
    } catch (e) {
        showResult('error', '⚠️', 'Input Error', e.message);
        return;
    }

    // Show grammar info
    showGrammarInfo(grammar);

    // Generate parse trees
    let trees;
    try {
        trees = generateParseTrees(grammar, tokens);
        currentTrees = trees;
    } catch (e) {
        showResult('error', '⚠️', 'Parsing Error', e.message);
        return;
    }

    if (trees.length === 0) {
        showResult('error', '⚠️', 'No Parse Found',
            `The string "${stringText}" cannot be derived from the given grammar starting from "${grammar.startSymbol}".`);
        return;
    }

    // Determine ambiguity
    const isAmbiguous = trees.length > 1;

    if (isAmbiguous) {
        showResult('ambiguous', '❌', 'AMBIGUOUS',
            `${trees.length} distinct parse tree${trees.length > 2 ? 's' : ''} found for the same string — the grammar is ambiguous.`);
    } else {
        showResult('not-ambiguous', '✅', 'NOT AMBIGUOUS',
            'Only one unique parse tree exists for this string — the grammar is unambiguous for this input.');
    }

    // Render parse trees
    renderParseTrees(trees, grammar);

    // Render derivations
    renderAllDerivations(trees, grammar, currentDerivationType);
}

/**
 * Show the result banner.
 */
function showResult(type, icon, label, description) {
    const section = document.getElementById('resultSection');
    const banner = document.getElementById('resultBanner');
    const resultIcon = document.getElementById('resultIcon');
    const resultLabel = document.getElementById('resultLabel');
    const resultDesc = document.getElementById('resultDesc');

    document.getElementById('outputPlaceholder').classList.add('hidden');
    section.classList.remove('hidden');

    banner.className = 'result-banner ' + type;
    resultIcon.textContent = icon;
    resultLabel.textContent = label;
    resultDesc.textContent = description;
}

/**
 * Show grammar info chips.
 */
function showGrammarInfo(grammar) {
    const section = document.getElementById('grammarInfoSection');
    section.classList.remove('hidden');

    const ntList = [...grammar.nonTerminals].join(', ');
    const tList = [...grammar.terminals].join(', ');
    let prodCount = 0;
    for (const prods of Object.values(grammar.rules)) {
        prodCount += prods.length;
    }

    section.innerHTML = `
        <div class="info-chip">
            <div>
                <div class="chip-label">Start Symbol</div>
                <div class="chip-value">${grammar.startSymbol}</div>
            </div>
        </div>
        <div class="info-chip">
            <div>
                <div class="chip-label">Non-Terminals</div>
                <div class="chip-value">{${ntList}}</div>
            </div>
        </div>
        <div class="info-chip">
            <div>
                <div class="chip-label">Terminals</div>
                <div class="chip-value">{${tList}}</div>
            </div>
        </div>
        <div class="info-chip">
            <div>
                <div class="chip-label">Productions</div>
                <div class="chip-value">${prodCount}</div>
            </div>
        </div>
    `;
}

/**
 * Render all parse trees as SVG.
 */
function renderParseTrees(trees, grammar) {
    const section = document.getElementById('treesSection');
    const grid = document.getElementById('treesGrid');
    section.classList.remove('hidden');
    grid.innerHTML = '';

    const treeLabels = ['tree-1', 'tree-2', 'tree-3'];
    const treeNames = ['Parse Tree 1', 'Parse Tree 2', 'Parse Tree 3'];

    trees.forEach((tree, index) => {
        if (index >= 3) return; // Show at most 3 trees

        const card = document.createElement('div');
        card.className = 'card tree-card';

        const label = document.createElement('div');
        label.className = `tree-label ${treeLabels[index] || 'tree-1'}`;
        label.textContent = `🌳 ${treeNames[index] || 'Parse Tree ' + (index + 1)}`;

        const container = document.createElement('div');
        container.className = 'tree-container';
        container.id = `treeContainer${index}`;

        card.appendChild(label);
        card.appendChild(container);
        grid.appendChild(card);

        // Render the SVG tree
        renderTree(tree, container, grammar.nonTerminals, index);
    });
}

/**
 * Render derivations for all trees.
 */
function renderAllDerivations(trees, grammar, type) {
    const section = document.getElementById('derivationSection');
    const grid = document.getElementById('derivationGrid');
    section.classList.remove('hidden');
    grid.innerHTML = '';

    const typeName = type === 'leftmost' ? 'Leftmost Derivation' : 'Rightmost Derivation';

    trees.forEach((tree, index) => {
        if (index >= 3) return;

        const card = document.createElement('div');
        card.className = 'card derivation-card';

        const label = document.createElement('div');
        label.className = 'deriv-label';
        label.textContent = `📋 Tree ${index + 1} — ${typeName}`;

        const stepsContainer = document.createElement('div');
        stepsContainer.id = `derivSteps${index}`;

        card.appendChild(label);
        card.appendChild(stepsContainer);
        grid.appendChild(card);

        const steps = getDerivation(tree, type);
        renderDerivation(steps, stepsContainer, grammar.nonTerminals);
    });
}

/**
 * Switch derivation type (leftmost/rightmost) via tabs.
 */
function switchDerivationType(type) {
    currentDerivationType = type;

    // Update tab active states
    document.querySelectorAll('.derivation-tabs .btn-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.type === type);
    });

    // Re-render derivations if we have trees
    if (currentTrees.length > 0 && currentGrammar) {
        renderAllDerivations(currentTrees, currentGrammar, type);
    }
}

/**
 * Clear all output sections.
 */
function clearResults() {
    document.getElementById('resultSection').classList.add('hidden');
    document.getElementById('grammarInfoSection').classList.add('hidden');
    document.getElementById('treesSection').classList.add('hidden');
    document.getElementById('derivationSection').classList.add('hidden');
    document.getElementById('outputPlaceholder').classList.remove('hidden');
    currentTrees = [];
}

/**
 * Load a predefined example.
 */
function loadExample(index) {
    const example = EXAMPLES[index];
    if (!example) return;

    document.getElementById('grammarInput').value = example.grammar;
    document.getElementById('stringInput').value = example.input;

    // Clear previous results
    clearResults();

    // Subtle visual feedback: flash the inputs
    const grammarInput = document.getElementById('grammarInput');
    const stringInput = document.getElementById('stringInput');
    grammarInput.style.borderColor = 'var(--accent)';
    stringInput.style.borderColor = 'var(--accent)';
    setTimeout(() => {
        grammarInput.style.borderColor = '';
        stringInput.style.borderColor = '';
    }, 600);
}

// ==========================================
// INITIALIZATION
// ==========================================

document.addEventListener('DOMContentLoaded', function () {
    // Populate example buttons
    const grid = document.getElementById('examplesGrid');
    EXAMPLES.forEach((example, index) => {
        const btn = document.createElement('button');
        btn.className = `btn btn-example ${example.cssClass}`;
        btn.textContent = example.name;
        btn.title = example.description;
        btn.onclick = () => loadExample(index);
        grid.appendChild(btn);
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function (e) {
        // Ctrl+Enter or Cmd+Enter to analyze
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            analyze();
        }
    });

    // Enter key in string input triggers analysis
    document.getElementById('stringInput').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            analyze();
        }
    });

    // Load first example by default so the UI isn't empty
    loadExample(0);
});
