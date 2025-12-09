// ====== 基本配置 ======
const ROWS = 8;
const COLS = 8;
const TILE_SIZE = 64;

// 一共 4 种普通图案
const TILE_TYPES = 4;

// 计分规则
const SCORE_3 = 100;
const SCORE_4 = 200;
const SCORE_5 = 300;

const TARGET_SCORE = 155800;

// 全局变量
let board = [];          // board[row][col] = 0~3
let game;
let tilesGroup;
let selected = null;     // {row, col}
let score = 0;
let highScore = 0;
let scoreText;
let highScoreText;
let isHandling = false;  // 正在处理消除/下落
let selectionBox;   //选中高亮框
const eggThresholds = [9200, 16500, 19200]; // 三个分数阈值
//const eggThresholds = [200, 2500, 4200];    //测试
let eggPlayed = [false, false, false];      // 每个阈值是否已经播放过

let isPaused = false;      // 是否暂停

let sfxEnabled = true;     // 普通消除音效开关
let eggEnabled = true;     // 彩蛋音效开关

let pauseButton;           // 右上角暂停按钮
let pausePanel;            // 暂停面板容器
let resumeText;            // “继续游戏”
let restartText;           // “重新开始”
let sfxText;               // “音效：开/关”
let eggText;               // “彩蛋音效：开/关”


// Phaser 游戏配置
const config = {
    type: Phaser.AUTO,
    parent: 'game-container', 
    width: COLS * TILE_SIZE,
    height: ROWS * TILE_SIZE + 50,
    backgroundColor: '#111111',

    // 自适应缩放 & 居中
    scale: {
        mode: Phaser.Scale.FIT,        // 按比例缩放，完整显示游戏区域
        autoCenter: Phaser.Scale.CENTER_BOTH
    },

    scene: {
        preload,
        create,
        update
    }
};

game = new Phaser.Game(config);

// ================== 预加载 ==================
function preload() {
    // 4 张普通方块
    this.load.image('tile0', 'assets/tile0.jpg');
    this.load.image('tile1', 'assets/tile1.jpg');
    this.load.image('tile2', 'assets/tile2.jpg');
    this.load.image('tile3', 'assets/tile3.jpg');

    // 特殊方块（五连合成用，先预加载，之后再用）
    this.load.image('tile_special', 'assets/tile_special.jpg');

    this.load.audio('egg1', 'assets/egg1.MP3'); // 9200 分
    this.load.audio('egg2', 'assets/egg2.MP3'); // 16500 分
    this.load.audio('egg3', 'assets/egg3.MP3'); // 19200 分

    this.load.audio('sfx_clear', 'assets/sfx_clear.MP3');
}

// ================== 创建场景 ==================
function create() {
    const scene = this;

    tilesGroup = this.add.group();

    // 载入本地最高分
    loadHighScore();

    // 初始化棋盘
    initBoard();
    // 创建对应精灵
    buildSprites(scene);

    selectionBox = scene.add.rectangle(
        0, 0,
        TILE_SIZE + 3,      
        TILE_SIZE + 3
    )
    .setStrokeStyle(3, 0xffff00) // 3 像素黄色边框
    .setVisible(false)           // 默认隐藏
    .setDepth(10);               // 保证在方块上面

    // === 底部 HUD 背景条 ===
    const hudY = ROWS * TILE_SIZE + 25; // 底部高度的一半
    const hudBg = this.add.rectangle(
        config.width / 2,
        hudY,
        config.width,
        50,
        0x000000,
        0.6
    ).setOrigin(0.5);
    hudBg.setDepth(0);

    // 分数文本
    scoreText = this.add.text(10, ROWS * TILE_SIZE + 5, 'Score: 0', {
        fontSize: '20px',
        color: '#ffffff'
    }).setDepth(1);

    highScoreText = this.add.text(200, ROWS * TILE_SIZE + 5, 'Best: ' + highScore, {
        fontSize: '20px',
        color: '#ffff66'
    }).setDepth(1);

    // ========== 右上角暂停按钮 ==========
    pauseButton = scene.add.text(
        config.width - 12,   // 右上角靠边
        10,
        '暂停',
        {
            fontFamily: '"Microsoft YaHei", "PingFang SC", "SimHei", system-ui, sans-serif',
            fontSize: '18px',
            color: '#ffffff',
            backgroundColor: 'rgba(0,0,0,0.6)'
        }
    )
    .setOrigin(1, 0)      // 以右上角为锚点
    .setPadding(8, 4, 8, 4)
    .setInteractive()
    .setDepth(20)
    .on('pointerdown', () => {
        setPaused(scene, !isPaused);
    });

    // ========== 暂停面板（默认隐藏） ==========
    const panelWidth = config.width * 0.7;
    const panelHeight = config.height * 0.6;

    pausePanel = scene.add.container(config.width / 2, config.height / 2)
        .setDepth(30)
        .setVisible(false);

    // 半透明背景遮罩
    const maskBg = scene.add.rectangle(0, 0, config.width, config.height, 0x000000, 0.4)
        .setOrigin(0.5);

    // 面板背景
    const panelBg = scene.add.rectangle(0, 0, panelWidth, panelHeight, 0x222222, 0.95)
        .setStrokeStyle(3, 0xffffff);

    const titleText = scene.add.text(0, -panelHeight / 2 + 40, '暂停', {
        fontFamily: '"Microsoft YaHei", "PingFang SC", "SimHei", system-ui, sans-serif',
        fontSize: '28px',
        color: '#ffffff'
    }).setOrigin(0.5);

    resumeText = scene.add.text(0, -20, '继续游戏', {
        fontFamily: '"Microsoft YaHei", "PingFang SC", "SimHei", system-ui, sans-serif',
        fontSize: '24px',
        color: '#ffffff'
    })
    .setOrigin(0.5)
    .setInteractive()
    .on('pointerdown', () => {
        setPaused(scene, false);
    });

    restartText = scene.add.text(0, 20, '重新开始本局', {
        fontFamily: '"Microsoft YaHei", "PingFang SC", "SimHei", system-ui, sans-serif',
        fontSize: '24px',
        color: '#ffffff'
    })
    .setOrigin(0.5)
    .setInteractive()
    .on('pointerdown', () => {
        resetGame(scene);
    });

    sfxText = scene.add.text(0, 60, '让高越闭嘴：否', {
        fontFamily: '"Microsoft YaHei", "PingFang SC", "SimHei", system-ui, sans-serif',
        fontSize: '24px',
        color: '#ffffff'
    })
    .setOrigin(0.5)
    .setInteractive()
    .on('pointerdown', () => {
        toggleSfx(scene);
    });

    eggText = scene.add.text(0, 100, '让所有人闭嘴：否', {
        fontFamily: '"Microsoft YaHei", "PingFang SC", "SimHei", system-ui, sans-serif',
        fontSize: '24px',
        color: '#ffffff'
    })
    .setOrigin(0.5)
    .setInteractive()
    .on('pointerdown', () => {
        toggleEgg(scene);
    });

    pausePanel.add([maskBg, panelBg, titleText, resumeText, restartText, sfxText, eggText]);
}


// ================== 棋盘初始化 ==================
function initBoard() {
    board = [];
    for (let r = 0; r < ROWS; r++) {
        board[r] = [];
        for (let c = 0; c < COLS; c++) {
            let type;
            while (true) {
                type = Phaser.Math.Between(0, TILE_TYPES - 1);

                let bad = false;
                // 横向检查：左边已经有两个同色
                if (c >= 2 &&
                    type === board[r][c - 1] &&
                    type === board[r][c - 2]) {
                    bad = true;
                }
                // 纵向检查：上面已经有两个同色
                if (!bad && r >= 2 &&
                    type === board[r - 1][c] &&
                    type === board[r - 2][c]) {
                    bad = true;
                }

                if (!bad) break;
            }
            board[r][c] = type;
        }
    }
}


// 用 board[][] 创建所有方块精灵（用在游戏开始 / 重置）
function buildSprites(scene) {
    if (tilesGroup) {
        tilesGroup.clear(true, true);
    }
    tilesGroup = scene.add.group();
    selected = null;

    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            const type = board[r][c];
            const x = c * TILE_SIZE + TILE_SIZE / 2;
            const y = r * TILE_SIZE + TILE_SIZE / 2;

            const tile = scene.add.image(x, y, 'tile' + type)
                .setDisplaySize(TILE_SIZE, TILE_SIZE)
                .setDepth(5)
                .setData('row', r)
                .setData('col', c)
                .setData('type', type)
                .setData('isSpecial', false) 
                .setInteractive();

            tile.on('pointerdown', () => {
                onTileClicked(scene, tile.getData('row'), tile.getData('col'));
            });

            tilesGroup.add(tile);
        }
    }
}

// ================== 点击逻辑 ==================
function onTileClicked(scene, row, col) {
    if (isHandling || isPaused) return;

    if (!selected) {
        selected = { row, col };
        highlightTile(true, row, col);
    } else {
        const r1 = selected.row;
        const c1 = selected.col;

        // 再点同一个：取消选中
        if (r1 === row && c1 === col) {
            highlightTile(false, r1, c1);
            selected = null;
            return;
        }

        // 是否相邻
        const isAdjacent =
            (r1 === row && Math.abs(c1 - col) === 1) ||
            (c1 === col && Math.abs(r1 - row) === 1);

        if (!isAdjacent) {
            // 改选新格子
            highlightTile(false, r1, c1);
            selected = { row, col };
            highlightTile(true, row, col);
            return;
        }

        // 相邻 → 尝试交换
        highlightTile(false, r1, c1);
        selected = null;
        trySwap(scene, r1, c1, row, col);
    }
}

function setPaused(scene, flag) {
    isPaused = flag;

    if (isPaused) {
        pausePanel.setVisible(true);
        pauseButton.setText('继续');

        // 暂停 tween 和计时器（棋盘动画停住）
        scene.tweens.timeScale = 0;
        scene.time.timeScale = 0;
    } else {
        pausePanel.setVisible(false);
        pauseButton.setText('暂停');

        scene.tweens.timeScale = 1;
        scene.time.timeScale = 1;
    }
}

// 缩放高亮
function highlightTile(on, row, col) {
    if (!selectionBox) return;

    if (on) {
        // 找到对应 tile，把选中框移动过去
        tilesGroup.children.iterate(tile => {
            if (!tile.active) return;
            if (tile.getData('row') === row && tile.getData('col') === col) {
                selectionBox.setPosition(tile.x, tile.y);
                selectionBox.setVisible(true);
            }
        });
    } else {
        selectionBox.setVisible(false);
    }
}

// ================== 尝试交换两个格子 ==================
function trySwap(scene, r1, c1, r2, c2) {
    isHandling = true;

    // 找到两个 tile
    let tileA = null;
    let tileB = null;

    tilesGroup.children.iterate(tile => {
        if (!tile.active) return;
        const tr = tile.getData('row');
        const tc = tile.getData('col');
        if (tr === r1 && tc === c1) tileA = tile;
        if (tr === r2 && tc === c2) tileB = tile;
    });

    if (!tileA || !tileB) {
        console.warn('找不到要交换的 tile，逻辑异常');
        isHandling = false;
        return;
    }

    const isSpecialA = tileA.getData('isSpecial');
    const isSpecialB = tileB.getData('isSpecial');

    // ===== 如果有特殊块参与交换 → 走特殊清除逻辑 =====
    if (isSpecialA || isSpecialB) {
        triggerSpecialClear(scene, tileA, tileB);
        return;
    }

    // ===== 否则走普通三消交换逻辑 =====

    // 1. 先交换 board 中的类型
    swapInBoard(r1, c1, r2, c2);

    const typeA = tileA.getData('type');
    const typeB = tileB.getData('type');

    // 2. 交换方块的 type & 贴图（位置不动，只换图案）
    tileA
        .setData('type', typeB)
        .setTexture('tile' + typeB)
        .setDisplaySize(TILE_SIZE, TILE_SIZE);

    tileB
        .setData('type', typeA)
        .setTexture('tile' + typeA)
        .setDisplaySize(TILE_SIZE, TILE_SIZE);

    // 3. 检查是否有三消
    const matchResult = findMatches();

    if (!matchResult.hasMatch) {
        // 没匹配 → 还原
        swapInBoard(r1, c1, r2, c2);

        tileA
            .setData('type', typeA)
            .setTexture('tile' + typeA)
            .setDisplaySize(TILE_SIZE, TILE_SIZE);

        tileB
            .setData('type', typeB)
            .setTexture('tile' + typeB)
            .setDisplaySize(TILE_SIZE, TILE_SIZE);

        isHandling = false;
        return;
    }

    // 有匹配 → 正常进入消除流程
    resolveBoard(scene, matchResult);
}

function triggerSpecialClear(scene, tileA, tileB) {
    // 哪个是特殊块，哪个是普通块
    const isSpecialA = tileA.getData('isSpecial');
    const isSpecialB = tileB.getData('isSpecial');

    let specialTile, otherTile;

    if (isSpecialA && !isSpecialB) {
        specialTile = tileA;
        otherTile = tileB;
    } else if (!isSpecialA && isSpecialB) {
        specialTile = tileB;
        otherTile = tileA;
    } else {
        // 两个都是特殊（或都不是，理论上不会到这里）
        specialTile = tileA;
        otherTile = tileB;
    }

    const targetType = otherTile.getData('type');

    const sr = specialTile.getData('row');
    const sc = specialTile.getData('col');
    const orow = otherTile.getData('row');
    const ocol = otherTile.getData('col');

    // 找出棋盘上所有等于 targetType 的格子
    let clearedCells = [];
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (board[r][c] === targetType) {
                clearedCells.push({ r, c });
            }
        }
    }

    // 把两颗参与交换的也清掉（即特殊块 + 普通块本身）
    clearedCells.push({ r: sr, c: sc });
    clearedCells.push({ r: orow, c: ocol });

    // 去重（防止重复）
    const posMap = {};
    clearedCells = clearedCells.filter(cell => {
        const k = cell.r + ',' + cell.c;
        if (posMap[k]) return false;
        posMap[k] = true;
        return true;
    });

    // 计分
    const add = clearedCells.length * 100;
    score += add;
    updateScoreText();
    checkEgg(scene);
    playClearSfx(scene);

    if (checkSpecialWin(scene)) {
        return;
    }

    const destroyDuration = 200;

    // 设为 -1 并播放消失动画
    clearedCells.forEach(cell => {
        const r = cell.r;
        const c = cell.c;
        board[r][c] = -1;

        tilesGroup.children.iterate(tile => {
            if (!tile.active) return;
            if (tile.getData('row') === r && tile.getData('col') === c) {
                scene.tweens.add({
                    targets: tile,
                    scale: 0,
                    duration: destroyDuration,
                    onComplete: () => tile.destroy()
                });
            }
        });
    });

    // 消失后 → 下落动画 + 补新块 → 再看有没有连锁三消
    scene.time.delayedCall(destroyDuration + 50, () => {
        collapseAndRefillWithAnimation(scene, () => {
            const newResult = findMatches();
            if (newResult.hasMatch) {
                handleMatchesOnce(scene, newResult);
            } else {
                isHandling = false;
                if (!hasPossibleMoves()) onGameOver(scene);
            }
        });
    });
}


// 交换 board 中两格
function swapInBoard(r1, c1, r2, c2) {
    const tmp = board[r1][c1];
    board[r1][c1] = board[r2][c2];
    board[r2][c2] = tmp;
}

// ================== 寻找所有三消及以上 ==================
function findMatches() {
    let marks = [];
    for (let r = 0; r < ROWS; r++) {
        marks[r] = [];
        for (let c = 0; c < COLS; c++) {
            marks[r][c] = false;
        }
    }

    let segments = []; // {len, cells:[{r,c}]}

    // ---- 水平 ----
    for (let r = 0; r < ROWS; r++) {
        let count = 1;
        for (let c = 1; c < COLS; c++) {
            if (board[r][c] !== -1 && board[r][c] === board[r][c - 1]) {
                count++;
            } else {
                if (count >= 3) {
                    const cells = [];
                    for (let k = 0; k < count; k++) {
                        marks[r][c - 1 - k] = true;
                        cells.push({ r, c: c - 1 - k });
                    }
                    segments.push({ len: count, cells });
                }
                count = 1;
            }
        }
        if (count >= 3) {
            const cells = [];
            for (let k = 0; k < count; k++) {
                marks[r][COLS - 1 - k] = true;
                cells.push({ r, c: COLS - 1 - k });
            }
            segments.push({ len: count, cells });
        }
    }

    // ---- 垂直 ----
    for (let c = 0; c < COLS; c++) {
        let count = 1;
        for (let r = 1; r < ROWS; r++) {
            if (board[r][c] !== -1 && board[r][c] === board[r - 1][c]) {
                count++;
            } else {
                if (count >= 3) {
                    const cells = [];
                    for (let k = 0; k < count; k++) {
                        marks[r - 1 - k][c] = true;
                        cells.push({ r: r - 1 - k, c });
                    }
                    segments.push({ len: count, cells });
                }
                count = 1;
            }
        }
        if (count >= 3) {
            const cells = [];
            for (let k = 0; k < count; k++) {
                marks[ROWS - 1 - k][c] = true;
                cells.push({ r: ROWS - 1 - k, c });
            }
            segments.push({ len: count, cells });
        }
    }

    return {
        hasMatch: segments.length > 0,
        marks,
        segments
    };
}

// 计算一次匹配带来的得分
function calcScoreDelta(segments) {
    let delta = 0;
    for (let seg of segments) {
        if (seg.len === 3) delta += SCORE_3;
        else if (seg.len === 4) delta += SCORE_4;
        else if (seg.len >= 5) delta += SCORE_5;
    }
    return delta;
}

// ================== 一次“消除 → 下落 → 再检测”流程 ==================
function resolveBoard(scene, firstMatchResult) {
    handleMatchesOnce(scene, firstMatchResult);
}

function handleMatchesOnce(scene, matchResult) {
    if (!matchResult.hasMatch) {
        isHandling = false;
        // 检查是否还有可行步
        if (!hasPossibleMoves()) onGameOver(scene);
        return;
    }

    // ===== 1. 计算加分，同时找出需要生成特殊块的位置 =====
    let specialCellsMap = {}; // key: "r,c" → {r,c}
    let add = 0;

    for (let seg of matchResult.segments) {
        if (seg.len === 3) add += SCORE_3;
        else if (seg.len === 4) add += SCORE_4;
        else if (seg.len >= 5) {
            add += SCORE_5;

            // 选中这一段的中间格子作为特殊块
            const midIndex = Math.floor(seg.cells.length / 2);
            const cell = seg.cells[midIndex]; // {r, c}
            const key = cell.r + ',' + cell.c;
            specialCellsMap[key] = cell;

            // 这个格子不参与本次消除
            matchResult.marks[cell.r][cell.c] = false;
        }
    }

    score += add;
    updateScoreText();
    checkEgg(scene);    //彩蛋
    playClearSfx(scene);    //哦莫

    if (checkSpecialWin(scene)) {
        return; // 已重置本局，不再继续后续动画
    }

    const destroyDuration = 200;

    // ===== 2. 把需要消除的格子设为 -1，并播放缩小消失动画 =====
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            if (matchResult.marks[r][c]) {
                board[r][c] = -1;
                tilesGroup.children.iterate(tile => {
                    if (!tile.active) return;
                    if (tile.getData('row') === r && tile.getData('col') === c) {
                        scene.tweens.add({
                            targets: tile,
                            scale: 0,
                            duration: destroyDuration,
                            onComplete: () => tile.destroy()
                        });
                    }
                });
            }
        }
    }

    // ===== 3. 把这些“保留下来的中间格子”变成特殊块（tile_special） =====
    Object.values(specialCellsMap).forEach(cell => {
        const r = cell.r;
        const c = cell.c;

        // board[r][c] 的类型照旧（0~3），只是 tile 变成特殊图
        tilesGroup.children.iterate(tile => {
            if (!tile.active) return;
            if (tile.getData('row') === r && tile.getData('col') === c) {
                tile.setData('isSpecial', true);
                tile.setTexture('tile_special')
                    .setDisplaySize(TILE_SIZE, TILE_SIZE);
            }
        });
    });

    // ===== 4. 消失动画结束后 → 下落动画 + 补新块 =====
    scene.time.delayedCall(destroyDuration + 50, () => {
        collapseAndRefillWithAnimation(scene, () => {
            // 下落+补充结束后，再检测是否有新的连锁消除
            const newResult = findMatches();
            if (newResult.hasMatch) {
                // 再来一轮
                handleMatchesOnce(scene, newResult);
            } else {
                isHandling = false;
                if (!hasPossibleMoves()) onGameOver(scene);
            }
        });
    });
}

// ================== 下落动画 + 补新块 ==================
function collapseAndRefillWithAnimation(scene, onComplete) {
    const fallDuration = 200;

    for (let c = 0; c < COLS; c++) {
        let emptyCount = 0;

        // 从下往上扫，统计空位并让上面的掉下来
        for (let r = ROWS - 1; r >= 0; r--) {
            if (board[r][c] === -1) {
                emptyCount++;
            } else if (emptyCount > 0) {
                const newRow = r + emptyCount;

                // 更新 board
                board[newRow][c] = board[r][c];
                board[r][c] = -1;

                // 找到对应精灵，做下落动画
                tilesGroup.children.iterate(tile => {
                    if (!tile.active) return;
                    if (tile.getData('row') === r && tile.getData('col') === c) {
                        tile.setData('row', newRow);
                        const targetY = newRow * TILE_SIZE + TILE_SIZE / 2;
                        scene.tweens.add({
                            targets: tile,
                            y: targetY,
                            duration: fallDuration
                        });
                    }
                });
            }
        }

        // 最上面的空位，用新方块补齐
        for (let i = 0; i < emptyCount; i++) {
            const r = i;
            const type = Phaser.Math.Between(0, TILE_TYPES - 1);
            board[r][c] = type;

            const x = c * TILE_SIZE + TILE_SIZE / 2;
            const targetY = r * TILE_SIZE + TILE_SIZE / 2;
            const startY = -TILE_SIZE / 2; // 从屏幕上方掉下来

            const tile = scene.add.image(x, startY, 'tile' + type)
                .setDisplaySize(TILE_SIZE, TILE_SIZE)
                .setDepth(5)
                .setData('row', r)
                .setData('col', c)
                .setData('type', type)
                .setData('isSpecial', false)
                .setInteractive();

            tile.on('pointerdown', () => {
                onTileClicked(scene, tile.getData('row'), tile.getData('col'));
            });

            tilesGroup.add(tile);

            scene.tweens.add({
                targets: tile,
                y: targetY,
                duration: fallDuration
            });
        }
    }

    // 等所有下落动画结束，再回调
    scene.time.delayedCall(fallDuration + 50, () => {
        if (onComplete) onComplete();
    });
}

// ================== 判断是否还有可行步 ==================
function hasPossibleMoves() {
    for (let r = 0; r < ROWS; r++) {
        for (let c = 0; c < COLS; c++) {
            // 和右边交换试试
            if (c + 1 < COLS) {
                if (willMatchAfterSwap(r, c, r, c + 1)) return true;
            }
            // 和下边交换试试
            if (r + 1 < ROWS) {
                if (willMatchAfterSwap(r, c, r + 1, c)) return true;
            }
        }
    }
    return false;
}

function willMatchAfterSwap(r1, c1, r2, c2) {
    swapInBoard(r1, c1, r2, c2);
    const result = findMatches();
    swapInBoard(r1, c1, r2, c2); // 换回去
    return result.hasMatch;
}

function playClearSfx(scene) {
    if (!sfxEnabled) return; // 关掉普通音效时直接不播
    scene.sound.play('sfx_clear', { volume: 0.6 });
}

function checkSpecialWin(scene) {
    if (score >= TARGET_SCORE) {
        // 更新最高分
        if (score > highScore) {
            highScore = score;
            saveHighScore();
        }

        alert('155800！五花八门夺冠了！快截图给四胞胎炫耀吧！本局得分：');

        // 重置本局
        score = 0;
        updateScoreText();
        eggPlayed = [false, false, false];

        initBoard();
        buildSprites(scene);
        isHandling = false;

        return true; // 已经结束本局
    }
    return false;    // 还没到目标分
}

// ================== 游戏结束 ==================
function onGameOver(scene) {
    // 更新最高分
    if (score > highScore) {
        highScore = score;
        saveHighScore();
    }

    alert('没有可消除的步了，游戏结束！本局得分：' + score);

    // 重置分数与棋盘
    score = 0;
    updateScoreText();
    eggPlayed = [false, false, false];
    initBoard();
    buildSprites(scene);
}

function resetGame(scene) {
    // 解除暂停状态
    isPaused = false;
    scene.tweens.timeScale = 1;
    scene.time.timeScale = 1;
    pausePanel.setVisible(false);
    pauseButton.setText('暂停');

    // 重置分数
    score = 0;
    updateScoreText();

    // 重置彩蛋播放状态
    eggPlayed = [false, false, false];

    // 重新生成棋盘
    initBoard();
    buildSprites(scene);

    isHandling = false;
}

function checkEgg(scene) {
    if (!eggEnabled) return;
    for (let i = 0; i < eggThresholds.length; i++) {
        if (!eggPlayed[i] && score >= eggThresholds[i]) {
            eggPlayed[i] = true;
            scene.sound.play('egg' + (i + 1));
        }
    }
}

function toggleSfx(scene) {
    sfxEnabled = !sfxEnabled;
    if (sfxText) {
        sfxText.setText('让高越闭嘴：' + (sfxEnabled ? '否' : '是'));
    }
}

function toggleEgg(scene) {
    eggEnabled = !eggEnabled;
    if (eggText) {
        eggText.setText('让所有人闭嘴：' + (eggEnabled ? '否' : '是'));
    }
}

// ================== 分数 & 本地存储 ==================
function updateScoreText() {
    if (score > highScore) {
        highScore = score;
        saveHighScore(); // 存本地
    }
    if (scoreText) {
        scoreText.setText('Score: ' + score);
    }
    if (highScoreText) {
        highScoreText.setText('Best: ' + highScore);
    }
}

function loadHighScore() {
    const v = localStorage.getItem('match3_highscore');
    highScore = v ? parseInt(v) : 0;
}

function saveHighScore() {
    localStorage.setItem('match3_highscore', String(highScore));
}

function update(time, delta) {
    // 目前不需要逐帧逻辑，可以先留空
    // 以后如果要做下落动画之类的实时效果，再往这里加
}
