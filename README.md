# A1111風スタイル選択ノード
v
このカスタムノードは A1111 のスタイル選択ライクなUIを模したノードです。

<img width="335" height="216" alt="image" src="https://github.com/user-attachments/assets/c743c4ca-4254-4c7a-bc59-ea99c8713df0" />

## ノードの種類

* A1111 Styles Selector (Tags)
  A1111 のスタイル風ノードです。
  `+ Add Style...` のドロップダウンリストから選択したスタイルを追加できます。  
  追加されたスタイルの右側にある **×** ボタンをクリックすると削除できます。

  | 初期状態 | スタイル追加例 |
  |-|-|
  | <img width="281" height="185" alt="image" src="https://github.com/user-attachments/assets/e7d05377-3eaa-4208-ab84-2c04363bd11a" /> | <img width="281" height="209" alt="image" src="https://github.com/user-attachments/assets/5d5e634f-65f6-4fb9-92e0-1911e3a5b2f5" /> |

* A1111 Styles Selector (CheckList)

  | 初期状態 | スタイル追加例 |
  |-|-|
  | <img width="314" height="380" alt="image" src="https://github.com/user-attachments/assets/abceace9-dac3-498b-86ca-c554fe368dca" /> | <img width="314" height="379" alt="image" src="https://github.com/user-attachments/assets/30c87689-463b-4553-909a-6e9f1b5ec1c8" /> |

## スタイル定義CSVファイル

A1111 のスタイルを共用できるようにComfyUIの `extra_model_paths.yaml` の定義に対応しています。  
A1111以外のCSVファイルは `custom_nodes/comfyui-a1111-styles/csv/` に格納します。

* extra_model_paths.yaml
  ComfyUI の extra_model_paths.yaml に下記の base_path が設定されている場合、base_path 直下に存在する styles.csv を参照します。

  ```
  a111:
      base_path: /StableDiffusion/stable-diffusion-webui/
  ```

  ノード上の csv_file から `styles.csv (A1111)` として選択可能です。

  <img width="288" height="99" alt="image" src="https://github.com/user-attachments/assets/74996c6c-dedf-4c75-ab1a-f2f34c89dc29" />

* A1111以外のCSVファイル
  `custom_nodes/comfyui-a1111-styles/csv/` に格納したファイルは `csv_file` から選択できます。

  `/csv/` に `styles.csv` を格納した場合  
  <img width="307" height="305" alt="image" src="https://github.com/user-attachments/assets/6e943afa-b1cf-44a7-986d-df0640670db2" />


## ポート

* 入力ポート
  前方に記述するプロンプトを入力できます。  
  入力されたプロンプトが `,` で終わっていない場合、プロンプトを区切るために自動で `,` を追加します。

  | ポート名 | 型 | 内容 |
  |-|-|-|
  | positive | STRING | ポジティブ・プロンプト |
  | negative | STRING | ネガティブ・プロンプト |

* 出力ポート

  | ポート名 | 型 | 内容 |
  |-|-|-|
  | positive | STRING | ポジティブ・プロンプト |
  | negative | STRING | ネガティブ・プロンプト |

## ノード接続

ポート `positive`, `negative` は `STRING` 型の為、プロンプト入力（文字列入力）へ接続して使用します。
* プロンプト入力へ直接接続した場合
  <img width="875" height="487" alt="image" src="https://github.com/user-attachments/assets/46cd7ed5-e59e-48e7-a360-078a23ddee64" />

* プロンプト手入力を行う場合  
  このノード出力とプロンプト手入力ノード出力を文字列連結ノードで合成します。そして、合成した結果をプロンプト入力へ接続します。
  <img width="1006" height="517" alt="image" src="https://github.com/user-attachments/assets/ac3a59c2-d8eb-4fdf-88ce-5e5e363f0620" />

## 今後の予定

* Node 2.0 対応
* CSVのスタイル追加機能
  <img width="864" height="396" alt="image" src="https://github.com/user-attachments/assets/c86d0bdf-2d59-4bfa-82a6-baf84cea56ed" />
