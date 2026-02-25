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

                    // Editボタンを追加
                    const editWidget = this.addWidget("button", "Edit", null, () => {
                        showEditDialog(csvWidget.value);
                    });

                    // Refreshボタンと同様に高さを確保
                    editWidget.computeSize = function(width) {
                        return [width, 26];
                    };

                    // 編集ダイアログ表示関数
                    const showEditDialog = async (filename) => {
                        // 既存のダイアログがあれば削除
                        const existing = document.getElementById("a1111-styles-edit-dialog");
                        if (existing) existing.remove();

                        // データ取得
                        let stylesData = {};
                        try {
                            const res = await api.fetchApi("/a1111_styles/data?filename=" + encodeURIComponent(filename));
                            stylesData = await res.json();
                        } catch (e) {
                            console.error("Failed to load styles data", e);
                            alert("Failed to load styles data.");
                            return;
                        }

                        // ダイアログ作成
                        const dialog = document.createElement("div");
                        dialog.id = "a1111-styles-edit-dialog";
                        Object.assign(dialog.style, {
                            position: "fixed",
                            top: "50%",
                            left: "50%",
                            transform: "translate(-50%, -50%)",
                            backgroundColor: "#333",
                            padding: "20px",
                            border: "1px solid #777",
                            zIndex: "10000",
                            width: "500px",
                            color: "#ddd",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                            boxShadow: "0 0 10px rgba(0,0,0,0.5)",
                            borderRadius: "5px"
                        });

                        dialog.innerHTML = `
                            <h3 style="margin:0 0 10px 0; color:#fff;">Edit Styles CSV: ${filename}</h3>
                            <div style="display:flex; gap:5px; align-items:center;">
                                <label style="flex:1;">Style Name: 
                                    <input list="a1111-styles-datalist" id="inp_style_name" style="width:100%; box-sizing:border-box; padding:4px; background:#222; color:#fff; border:1px solid #555;">
                                </label>
                                <button id="btn_refresh_csv" style="padding:4px 8px; cursor:pointer;">↻</button>
                            </div>
                            <datalist id="a1111-styles-datalist"></datalist>
                            
                            <label>Positive Prompt: 
                                <textarea id="ta_pos" rows="4" style="width:100%; box-sizing:border-box; background:#222; color:#fff; border:1px solid #555; resize:vertical;"></textarea>
                            </label>
                            <label>Negative Prompt: 
                                <textarea id="ta_neg" rows="4" style="width:100%; box-sizing:border-box; background:#222; color:#fff; border:1px solid #555; resize:vertical;"></textarea>
                            </label>
                            
                            <div style="display:flex; gap:10px; margin-top:10px;">
                                <button id="btn_save" style="flex:1; padding:6px 12px; cursor:pointer; background:#444; color:#fff; border:1px solid #666;">Save</button>
                                <button id="btn_delete" style="flex:1; padding:6px 12px; cursor:pointer; background:#a00; color:#fff; border:1px solid #c00; display:none;">Delete</button>
                                <button id="btn_close" style="flex:1; padding:6px 12px; cursor:pointer; background:#444; color:#fff; border:1px solid #666;">Close</button>
                            </div>
                        `;
                        document.body.appendChild(dialog);

                        const inpName = dialog.querySelector("#inp_style_name");
                        const datalist = dialog.querySelector("#a1111-styles-datalist");
                        const taPos = dialog.querySelector("#ta_pos");
                        const taNeg = dialog.querySelector("#ta_neg");
                        const btnSave = dialog.querySelector("#btn_save");
                        const btnDelete = dialog.querySelector("#btn_delete");
                        const btnClose = dialog.querySelector("#btn_close");
                        const btnRefresh = dialog.querySelector("#btn_refresh_csv");

                        // データリスト構築
                        const updateDatalist = () => {
                            datalist.innerHTML = "";
                            Object.keys(stylesData).sort().forEach(name => {
                                const opt = document.createElement("option");
                                opt.value = name;
                                datalist.appendChild(opt);
                            });
                        };
                        updateDatalist();

                        // 入力イベント
                        inpName.oninput = () => {
                            const name = inpName.value;
                            if (name === "") {
                                btnSave.textContent = "Save";
                                btnSave.style.backgroundColor = "#444";
                                btnDelete.style.display = "none";
                                return;
                            }
                            if (stylesData[name]) {
                                taPos.value = stylesData[name][0] || "";
                                taNeg.value = stylesData[name][1] || "";
                                btnSave.textContent = "Save";
                                btnSave.style.backgroundColor = "#236692";
                                btnDelete.style.display = "block";
                            } else {
                                // 新規
                                // 既存データがない場合は入力内容を維持する（クリアしない）
                                btnSave.textContent = "Add";
                                btnSave.style.backgroundColor = "#28a745";
                                btnDelete.style.display = "none";
                            }
                        };

                        // 保存処理
                        btnSave.onclick = async () => {
                            const name = inpName.value.trim();
                            if (!name) return alert("Please enter a style name.");
                            
                            try {
                                const res = await api.fetchApi("/a1111_styles/save", {
                                    method: "POST",
                                    body: JSON.stringify({
                                        filename: filename,
                                        style_name: name,
                                        positive: taPos.value,
                                        negative: taNeg.value
                                    })
                                });
                                const result = await res.json();
                                if (result.success) {
                                    // 成功したらデータを再取得してリスト更新
                                    const dataRes = await api.fetchApi("/a1111_styles/data?filename=" + encodeURIComponent(filename));
                                    stylesData = await dataRes.json();
                                    updateDatalist();
                                    // ノード側のリストも更新
                                    updateStyles(filename);
                                    alert("Saved successfully.");
                                    // 入力状態をリセット（保存後の状態に）
                                    inpName.dispatchEvent(new Event('input'));
                                } else {
                                    alert("Error: " + result.error);
                                }
                            } catch (e) {
                                alert("Save failed: " + e);
                            }
                        };

                        // 削除処理
                        btnDelete.onclick = async () => {
                            const name = inpName.value;
                            if (!confirm(`Are you sure you want to delete style "${name}"?`)) return;

                            try {
                                const res = await api.fetchApi("/a1111_styles/delete", {
                                    method: "POST",
                                    body: JSON.stringify({
                                        filename: filename,
                                        style_name: name
                                    })
                                });
                                const result = await res.json();
                                if (result.success) {
                                    const dataRes = await api.fetchApi("/a1111_styles/data?filename=" + encodeURIComponent(filename));
                                    stylesData = await dataRes.json();
                                    updateDatalist();
                                    updateStyles(filename);
                                    alert("Deleted successfully.");
                                    inpName.value = "";
                                    inpName.dispatchEvent(new Event('input'));
                                } else {
                                    alert("Error: " + result.error);
                                }
                            } catch (e) {
                                alert("Delete failed: " + e);
                            }
                        };

                        // 更新ボタン
                        btnRefresh.onclick = async () => {
                            try {
                                const dataRes = await api.fetchApi("/a1111_styles/data?filename=" + encodeURIComponent(filename));
                                stylesData = await dataRes.json();
                                updateDatalist();
                                updateStyles(filename);
                                inpName.dispatchEvent(new Event('input'));
                            } catch(e) {
                                alert("Refresh failed");
                            }
                        };

                        btnClose.onclick = () => dialog.remove();
                    };

                    // 2. ウィジェットの順序を入れ替え: csv -> Refresh -> Edit -> selected_styles
                    // これにより selected_styles が最下部に来るため、そこをリスト表示領域として利用する
                    const stylesIdx = this.widgets.indexOf(stylesWidget);
                    const refreshIdx = this.widgets.indexOf(refreshWidget);
                    const editIdx = this.widgets.indexOf(editWidget);
                    
                    // 一旦削除して再配置
                    this.widgets.splice(refreshIdx, 1);
                    this.widgets.splice(editIdx - 1, 1); // refresh削除でインデックスずれるので注意が必要だが、findで取ったオブジェクトを使うのでspliceで消す
                    
                    // 正確にはオブジェクトから再配置する
                    // 現在のwidgets配列からrefreshとeditを除去
                    this.widgets = this.widgets.filter(w => w !== refreshWidget && w !== editWidget);
                    
                    // stylesWidgetのインデックスを再取得
                    const newStylesIdx = this.widgets.indexOf(stylesWidget);
                    
                    // stylesWidgetの前に挿入
                    this.widgets.splice(newStylesIdx, 0, refreshWidget, editWidget);

                    /* 
                    // 元のロジック（参考）
                    if (refreshIdx > stylesIdx) {
                        this.widgets.splice(refreshIdx, 1);
                        this.widgets.splice(stylesIdx, 0, refreshWidget);
                    }
                    */

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

                    // 表示状態の監視ループ
                    // サブグラフへの切り替え時などにオーバーレイが残るのを防ぐ
                    const checkVisibility = () => {
                        if (!styleListContainer.isConnected) return; // DOMから削除されていたら終了

                        if (this.graph && app.canvas && app.canvas.graph && this.graph !== app.canvas.graph) {
                            styleListContainer.style.display = "none";
                        }
                        requestAnimationFrame(checkVisibility);
                    };
                    requestAnimationFrame(checkVisibility);

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
                            
                            // 1. 選択済みタグエリア
                            const tagsContainer = document.createElement("div");
                            Object.assign(tagsContainer.style, {
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "4px",
                                alignContent: "flex-start",
                                marginBottom: "8px"
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
                                Object.assign(closeBtn.style, {
                                    cursor: "pointer",
                                    fontWeight: "bold",
                                    marginLeft: "5px",
                                    fontSize: "14px",
                                    padding: "0 5px"
                                });
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

                            // 2. 追加用ドロップダウン
                            const selectWrapper = document.createElement("div");
                            Object.assign(selectWrapper.style, {
                                marginBottom: "4px",
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

                            // 高さ自動調整
                            // タグ追加などでコンテンツが増えた場合、ノードの高さを拡張して表示領域を確保する
                            setTimeout(() => {
                                if (stylesWidget.last_y) {
                                    // コンテナの高さを一時的にautoにして真のコンテンツ高さを取得
                                    // これを行わないと、現在のコンテナ高さ(this.size[1])がscrollHeightとして返され、
                                    // 削除時にも高さが増え続けてしまう
                                    const prevHeight = styleListContainer.style.height;
                                    styleListContainer.style.height = "auto";

                                    const scale = app.canvas.ds.scale;
                                    const contentHeight = styleListContainer.scrollHeight / scale;
                                    
                                    // 測定後に戻す
                                    styleListContainer.style.height = prevHeight;

                                    const widgetY = stylesWidget.last_y;
                                    const margin = 0;
                                    const neededHeight = widgetY + contentHeight + margin;
                                    
                                    // 最小高さ（タグモード用）
                                    const minHeight = 140;
                                    const targetHeight = Math.max(minHeight, neededHeight);

                                    // サイズが不足している場合のみ更新（拡張）
                                    if (targetHeight > this.size[1]) {
                                        this.setSize([this.size[0], targetHeight]);
                                        this.setDirtyCanvas(true, true);
                                    }
                                }
                            }, 0);

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

                    // ノードの最小サイズを確保
                    this.size[0] = Math.max(this.size[0], 280);
                    this.size[1] = Math.max(this.size[1], isTagsMode ? 140 : 350);
                }

                return r;
            };
        }
    }
});