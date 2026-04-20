# 🌳 Grammar Ambiguity Detector & Visualizer

> Analyze context-free grammars (CFGs) for ambiguity by generating and comparing multiple parse trees with step-by-step derivations — all in the browser, no installation required.

---

## 📌 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Demo](#demo)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Examples](#examples)
- [Project Structure](#project-structure)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

**Grammar Ambiguity Detector & Visualizer** is a browser-based tool built for students and educators studying **Theory of Computation** and **Compiler Design**. It takes a context-free grammar (CFG) and an input string, then determines whether the grammar is **ambiguous** — meaning the string can be derived in more than one way — and visually demonstrates this by rendering **multiple distinct parse trees** side by side.

Ambiguity is a fundamental concept in formal language theory. This tool makes it concrete and visual.

---

## Features

- 📝 **CFG Input** — Enter production rules in standard notation (`E -> E + E | E * E | id`)
- 🔍 **Ambiguity Detection** — Automatically detects if the input string has more than one valid parse tree
- 🌳 **Parse Tree Visualization** — Renders all discovered parse trees graphically
- 📋 **Step-by-Step Derivations** — Shows both **leftmost** and **rightmost** derivations for each parse tree
- 📌 **Predefined Examples** — One-click example grammars to get started instantly
- 📊 **Grammar Info Panel** — Displays terminals, non-terminals, start symbol, and production count
- 💡 **Pure Frontend** — Runs entirely in the browser; no server or installation needed

---

## Demo

> Open `index.html` directly in your browser — no build step required.

**Try this example:**

| Grammar | Input String |
|---------|-------------|
| `E -> E + E \| E * E \| id` | `id + id * id` |

This classic arithmetic grammar is **ambiguous** — the string `id + id * id` can be parsed in two different ways (depending on operator precedence), producing two distinct parse trees.

---

## Getting Started

### Option 1 — Open Directly (Recommended)

```bash
# Clone the repository
git clone https://github.com/your-username/grammar-ambiguity-detector.git

# Navigate to the project folder
cd grammar-ambiguity-detector

# Open in your browser
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

### Option 2 — Live Server (VS Code)

If you use VS Code, install the **Live Server** extension, right-click `index.html`, and select **"Open with Live Server"**.

### Option 3 — GitHub Pages

You can host this directly on GitHub Pages since it's a static site:

1. Go to your repository **Settings → Pages**
2. Set source to `main` branch, root `/`
3. Your tool will be live at `https://your-username.github.io/grammar-ambiguity-detector/`

---

## Usage

### Step 1 — Enter a Grammar

Type your CFG production rules in the **Grammar Rules** textarea:

```
E -> E + E | E * E | id
```

**Rules:**
- Use `->` for the production arrow
- Use `|` to separate alternatives on the same rule
- Separate all symbols with spaces
- The **left-hand side of the first rule** is treated as the start symbol
- Both uppercase (non-terminals) and lowercase/special (terminals) are supported

### Step 2 — Enter an Input String

Type the string to parse in the **Input String** field:

```
id + id * id
```

Tokens must be separated by spaces and must match the terminal symbols defined in your grammar.

### Step 3 — Analyze

Click **🔍 Analyze Grammar** to run the analysis.

### Step 4 — Read the Results

| Result | Meaning |
|--------|---------|
| ✅ **Unambiguous** | Only one parse tree exists for the input string |
| ⚠️ **Ambiguous** | Two or more parse trees were found — grammar is ambiguous |
| ❌ **String not in language** | The input string cannot be derived from the grammar |

---

## Examples

The tool ships with predefined examples accessible via the **"Predefined Examples"** buttons. Some classic cases:

### 1. Classic Arithmetic (Ambiguous)
```
E -> E + E | E * E | id
```
Input: `id + id * id`
→ Ambiguous: operator precedence is undefined in this grammar.

### 2. Dangling Else (Ambiguous)
```
S -> if E then S | if E then S else S | other
E -> b
```
Input: `if b then if b then other else other`
→ Ambiguous: the `else` can bind to either `if`.

### 3. Unambiguous Arithmetic
```
E -> E + T | T
T -> T * F | F
F -> id
```
Input: `id + id * id`
→ Unambiguous: precedence is enforced by grammar structure.

---

## Project Structure

```
grammar-ambiguity-detector/
├── index.html      # Application markup and layout
├── style.css       # All styling (dark/light theme, cards, tree rendering)
├── script.js       # Core logic: CFG parsing, CYK/exhaustive search, tree rendering
└── README.md       # This file
```

### Key Responsibilities

| File | Responsibility |
|------|---------------|
| `index.html` | App shell, input forms, output sections, derivation tabs |
| `style.css` | Responsive layout, parse tree SVG styling, result banners |
| `script.js` | Grammar parser, ambiguity detection engine, parse tree builder, derivation generator, DOM rendering |

---

## How It Works

### 1. Grammar Parsing
The input grammar text is parsed into a set of production rules. Non-terminals are identified as symbols appearing on the left-hand side of any rule. The start symbol is the LHS of the first rule.

### 2. Ambiguity Detection
The tool performs an **exhaustive parse** of the input string against the grammar using a recursive descent / chart-parsing approach. It collects **all** possible parse trees rather than stopping at the first valid one. If more than one distinct tree is found, the grammar is flagged as ambiguous for that string.

> ⚠️ Note: Detecting grammar ambiguity in general is **undecidable**. This tool tests ambiguity for a *specific input string*, which is decidable (though potentially expensive for large inputs or deeply recursive grammars).

### 3. Parse Tree Visualization
Each distinct parse tree is rendered graphically as a node-link diagram, with non-terminals shown as internal nodes and terminals as leaves.

### 4. Derivation Generation
For each parse tree, both **leftmost** (always expand the leftmost non-terminal first) and **rightmost** (always expand the rightmost non-terminal first) derivations are computed and displayed step by step.

---

## Tech Stack

| Technology | Role |
|------------|------|
| **HTML5** | Application structure and semantic markup |
| **CSS3** | Layout, animations, parse tree styling |
| **Vanilla JavaScript (ES6+)** | Grammar engine, tree algorithms, DOM rendering |

No frameworks. No dependencies. No build step. Pure web standards.

---

## Contributing

Contributions are welcome! Here are some ideas:

- [ ] Support for epsilon (ε) productions
- [ ] Export parse trees as PNG/SVG
- [ ] Show ambiguity for **all** strings up to a given length
- [ ] Highlight the differing subtrees between ambiguous parse trees
- [ ] Add more predefined grammar examples
- [ ] Improve performance for grammars with deep recursion

To contribute:

```bash
# Fork the repo, then:
git checkout -b feature/your-feature-name
# Make your changes
git commit -m "Add: description of your change"
git push origin feature/your-feature-name
# Open a Pull Request
```

## Acknowledgements

Built as part of a **Theory of Computation** course project. Inspired by the need for interactive, visual tools to understand one of the trickier concepts in formal language theory.

---

*If this tool helped you understand grammar ambiguity, consider giving it a ⭐ on GitHub!*

