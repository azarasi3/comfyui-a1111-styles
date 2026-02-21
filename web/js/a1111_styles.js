import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

app.registerExtension({
    name: "ComfyUI.A1111Styles",
    async beforeRegisterNodeDef(nodeType, nodeData, app) {
        // ノード名でモードを判定
        const isTagsMode = nodeData.name === "A1111_Styles_Selector_Tags";
        const isCheckListMode = nodeData.name === "A1111_Styles_Selector_CheckList";

        if (isTagsMode || isCheckListMode) {
            const onNodeCreated = nodeType.prototype.onNodeCreated;
            nodeType.prototype.onNodeCreated = function () {
                const r = onNodeCreated ? onNodeCreated.apply(this, arguments) : undefined;

                const csvWidget = this.widgets.find(w => w.name === "csv_file");
                const stylesWidget = this.widgets.find(w => w.name === "selected_styles");

                if (csvWidget && stylesWidget) {
                    // 1. Refreshボタンをウィジェットとして追加
                    const refreshWidget = this.addWidget("button", "Refresh", null, () => {
                        api.fetchApi("/a1111_styles/refresh")
                            .then(response => response.json())
                            .then(fileList => {
                                csvWidget.options.values = fileList;
                                if (!fileList.includes(csvWidget.value)) {
                                    csvWidget.value = fileList.includes("styles.csv (A1111)") ? "styles.csv (A1111)" : (fileList[0] || "None");
                                }
                                if (csvWidget.callback) {
                                    csvWidget.callback(csvWidget.value);
                                }
                            });
                    });

                    // 2. ウィジェットの順序を入れ替え: csv -> Refresh -> selected_styles
                    // これにより selected_styles が最下部に来るため、そこをリスト表示領域として利用する
                    const stylesIdx = this.widgets.indexOf(stylesWidget);
                    const refreshIdx = this.widgets.indexOf(refreshWidget);
                    if (refreshIdx > stylesIdx) {
                        this.widgets.splice(refreshIdx, 1);
                        this.widgets.splice(stylesIdx, 0, refreshWidget);
                    }

                    // 3. HTMLオーバーレイの作成
                    const styleListContainer = document.createElement("div");
                    Object.assign(styleListContainer.style, {
                        position: "absolute",
                        overflowY: "auto",
                        backgroundColor: "#222",
                        border: isTagsMode ? "none" : "1px solid #555", // タグモードは枠線なしですっきりさせる
                        boxSizing: "border-box",
                        color: "#ddd",
                        fontSize: "12px",
                        display: "flex",
                        flexDirection: "column"
                    });
                    document.body.appendChild(styleListContainer);

                    // ノード削除時にDOMも削除
                    const onRemoved = this.onRemoved;
                    this.onRemoved = function() {
                        if (styleListContainer) styleListContainer.remove();
                        if (onRemoved) onRemoved.apply(this, arguments);
                    };

                    // 4. selected_styles ウィジェットをプレースホルダーとして設定
                    // 描画処理をオーバーライドして、座標(y)を保存しつつ、何も描画しないようにする
                    stylesWidget.draw = function(ctx, node, widgetWidth, y, widgetHeight) {
                        stylesWidget.last_y = y + widgetHeight; // 座標を保存
                        stylesWidget.last_w = widgetWidth; // 幅を保存
                    };
                    // 最小限の高さを確保（レイアウト計算用）
                    stylesWidget.computeSize = function(width) {
                        return [width, 0];
                    };

                    // 描画時にDOMの位置とサイズを更新
                    const onDrawBackground = this.onDrawBackground;
                    this.onDrawBackground = function(ctx) {
                        if (onDrawBackground) onDrawBackground.apply(this, arguments);

                        if (this.flags.collapsed) {
                            styleListContainer.style.display = "none";
                            return;
                        }

                        // ウィジェットの座標がまだ計算されていない場合はスキップ
                        if (stylesWidget.last_y === undefined) return;

                        // ノードの位置計算
                        const transform = ctx.getTransform();
                        
                        // selected_styles ウィジェットの位置に合わせて表示
                        // Refreshボタンの下（selected_stylesの場所）からノードの最下部までを使う（動的計算）
                        // computeSizeによりRefreshボタンの高さ分が確保されているため、last_yはボタンの下を指す
                        const widgetY = stylesWidget.last_y;
                        const widgetWidth = stylesWidget.last_w || (this.size[0] - 20);
                        
                        // 水平マージンを計算（左右対称と仮定）
                        const marginX = (this.size[0] - widgetWidth) / 2;
                        
                        // 画面上の座標に変換
                        const x = transform.e + (marginX * transform.a);
                        const y = transform.f + (widgetY * transform.d);
                        const w = widgetWidth * transform.a;
                        // 下部にも水平方向と同じマージンを確保して高さを決定
                        const h = Math.max(0, (this.size[1] - widgetY - marginX) * transform.d);

                        styleListContainer.style.display = "flex";
                        styleListContainer.style.left = x + "px";
                        styleListContainer.style.top = y + "px";
                        styleListContainer.style.width = w + "px";
                        styleListContainer.style.height = h + "px";
                    };

                    const updateStyles = async (filename) => {
                        try {
                            const response = await api.fetchApi("/a1111_styles/styles?filename=" + encodeURIComponent(filename));
                            const styles = await response.json();
                            
                            // DOMリストを更新
                            renderStyleList(styles);
                            
                            this.setDirtyCanvas(true, true);
                        } catch (err) {
                            console.error("Error fetching styles:", err);
                        }
                    };

                    const renderStyleList = (styles) => {
                        styleListContainer.innerHTML = "";
                        let currentSelected = [];
                        try {
                            currentSelected = JSON.parse(stylesWidget.value || "[]");
                        } catch(e) {}

                        if (isTagsMode) {
                            // --- タグ選択モード (ドロップダウン + タグ表示) ---
                            
                            // 1. 追加用ドロップダウン
                            const selectWrapper = document.createElement("div");
                            Object.assign(selectWrapper.style, {
                                marginBottom: "8px",
                                flexShrink: "0"
                            });

                            const select = document.createElement("select");
                            Object.assign(select.style, {
                                width: "100%",
                                padding: "4px",
                                backgroundColor: "#222",
                                color: "#eee",
                                border: "1px solid #555",
                                borderRadius: "4px"
                            });
                            
                            const defaultOption = document.createElement("option");
                            defaultOption.text = "＋ Add Style...";
                            defaultOption.value = "";
                            select.appendChild(defaultOption);

                            // 未選択のスタイルのみを選択肢に追加
                            styles.forEach(styleName => {
                                if (!currentSelected.includes(styleName)) {
                                    const opt = document.createElement("option");
                                    opt.value = styleName;
                                    opt.text = styleName;
                                    select.appendChild(opt);
                                }
                            });

                            select.onchange = () => {
                                if (select.value) {
                                    currentSelected.push(select.value);
                                    stylesWidget.value = JSON.stringify(currentSelected);
                                    renderStyleList(styles); // 再描画
                                }
                            };
                            selectWrapper.appendChild(select);
                            styleListContainer.appendChild(selectWrapper);

                            // 2. 選択済みタグエリア
                            const tagsContainer = document.createElement("div");
                            Object.assign(tagsContainer.style, {
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "4px",
                                alignContent: "flex-start"
                            });

                            currentSelected.forEach(styleName => {
                                const tag = document.createElement("div");
                                Object.assign(tag.style, {
                                    display: "flex",
                                    alignItems: "center",
                                    backgroundColor: "#236692",
                                    color: "#fff",
                                    padding: "2px 6px",
                                    borderRadius: "12px",
                                    fontSize: "11px",
                                    border: "1px solid #457799"
                                });

                                const text = document.createElement("span");
                                text.textContent = styleName;
                                text.style.marginRight = "4px";
                                tag.appendChild(text);

                                const closeBtn = document.createElement("span");
                                closeBtn.textContent = "×";
                                closeBtn.style.cursor = "pointer",
                                closeBtn.style.fontWeight = "bold";
                                closeBtn.onclick = () => {
                                    const idx = currentSelected.indexOf(styleName);
                                    if (idx > -1) {
                                        currentSelected.splice(idx, 1);
                                        stylesWidget.value = JSON.stringify(currentSelected);
                                        renderStyleList(styles);
                                    }
                                };
                                tag.appendChild(closeBtn);

                                tagsContainer.appendChild(tag);
                            });
                            styleListContainer.appendChild(tagsContainer);

                            return; // タグモードの描画終了
                        }

                        // --- 既存のリスト選択モード ---

                        // アクションボタン（Clear / Invert）の追加
                        const actionsDiv = document.createElement("div");
                        Object.assign(actionsDiv.style, {
                            display: "flex",
                            gap: "4px",
                            marginBottom: "4px",
                            flexShrink: "0"
                        });

                        const createBtn = (label, fn) => {
                            const btn = document.createElement("button");
                            btn.textContent = label;
                            Object.assign(btn.style, {
                                flex: "1",
                                backgroundColor: "#222",
                                color: "#ccc",
                                border: "1px solid #444",
                                borderRadius: "3px",
                                cursor: "pointer",
                                fontSize: "10px",
                                padding: "2px 4px"
                            });
                            btn.onclick = fn;
                            btn.onmouseenter = () => btn.style.backgroundColor = "#444";
                            btn.onmouseleave = () => btn.style.backgroundColor = "#222";
                            return btn;
                        };

                        actionsDiv.appendChild(createBtn("Clear", () => {
                            stylesWidget.value = "[]";
                            renderStyleList(styles);
                        }));

                        actionsDiv.appendChild(createBtn("Invert", () => {
                            const newSelected = styles.filter(s => !currentSelected.includes(s));
                            stylesWidget.value = JSON.stringify(newSelected);
                            renderStyleList(styles);
                        }));

                        styleListContainer.appendChild(actionsDiv);

                        styles.forEach(styleName => {
                            const button = document.createElement("button");
                            const isSelected = currentSelected.includes(styleName);
                            
                            Object.assign(button.style, {
                                display: "block",
                                width: "100%",
                                textAlign: "left",
                                padding: "4px 8px",
                                marginBottom: "2px",
                                border: "1px solid #444",
                                borderRadius: "3px",
                                cursor: "pointer",
                                backgroundColor: isSelected ? "#236692" : "#333",
                                color: isSelected ? "#fff" : "#ccc",
                                fontSize: "12px",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                flexShrink: "0"
                            });
                            
                            button.textContent = styleName;

                            button.onmouseenter = () => {
                                let selected = false;
                                try { selected = JSON.parse(stylesWidget.value || "[]").includes(styleName); } catch(e){}
                                if (!selected) button.style.backgroundColor = "#444";
                            };
                            button.onmouseleave = () => {
                                let selected = false;
                                try { selected = JSON.parse(stylesWidget.value || "[]").includes(styleName); } catch(e){}
                                if (!selected) button.style.backgroundColor = "#333";
                            };

                            button.onclick = () => {
                                let selected = [];
                                try {
                                    selected = JSON.parse(stylesWidget.value || "[]");
                                } catch(e) {}

                                const index = selected.indexOf(styleName);
                                if (index > -1) {
                                    selected.splice(index, 1);
                                    button.style.backgroundColor = "#444"; // hover state
                                    button.style.color = "#ccc";
                                } else {
                                    selected.push(styleName);
                                    button.style.backgroundColor = "#236692";
                                    button.style.color = "#fff";
                                }
                                stylesWidget.value = JSON.stringify(selected);
                            };

                            styleListContainer.appendChild(button);
                        });
                    };

                    // CSVファイル変更時のコールバックを設定
                    const originalCallback = csvWidget.callback;
                    csvWidget.callback = function(v) {
                        updateStyles(v);
                        if (originalCallback) {
                            return originalCallback.apply(this, arguments);
                        }
                    };

                    // 初期化時に現在の値でリストを更新（ワークフロー読み込み対応）
                    setTimeout(() => {
                        updateStyles(csvWidget.value);
                    }, 50);
                }

                return r;
            };
        }
    }
});