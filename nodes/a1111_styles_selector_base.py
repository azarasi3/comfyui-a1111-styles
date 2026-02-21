import yaml
import csv
import glob
import json
import os
import folder_paths

class A1111StylesSelectorBase:
    """
    A1111スタイルのカスタムノードのスケルトンクラスです。
    """
    A1111_STYLES_KEY = "styles.csv (A1111)"
    _file_paths_cache = None

    def __init__(self):
        pass

    @staticmethod
    def load_csv(path):
        styles = {}
        if not os.path.exists(path):
            return styles
        try:
            with open(path, 'r', encoding='utf-8-sig') as f:
                reader = csv.reader(f)
                next(reader, None)  # ヘッダー行をスキップ
                for row in reader:
                    if row and len(row) >= 3:
                        styles[row[0]] = (row[1], row[2])
        except Exception as e:
            print(f"Error loading styles from {path}: {e}")
        return styles

    @classmethod
    def get_file_paths(cls):
        if cls._file_paths_cache is not None:
            return cls._file_paths_cache

        paths = {}
        # A1111 yaml check
        try:
            yaml_path = os.path.join(folder_paths.base_path, "extra_model_paths.yaml")
            if os.path.exists(yaml_path):
                with open(yaml_path, 'r', encoding='utf-8') as f:
                    config = yaml.safe_load(f)

                if config and "a111" in config and "base_path" in config["a111"]:
                    base_path = config["a111"]["base_path"]
                    csv_path = os.path.join(base_path, "styles.csv")
                    if os.path.exists(csv_path):
                        paths[cls.A1111_STYLES_KEY] = csv_path
        except Exception as e:
            print(f"Error loading A1111 styles from yaml: {e}")

        # ローカルのcsvフォルダをスキャン
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            root_dir = os.path.dirname(current_dir)
            csv_dir = os.path.join(root_dir, "csv")

            if os.path.exists(csv_dir):
                for file_path in glob.glob(os.path.join(csv_dir, "*.csv")):
                    filename = os.path.basename(file_path)
                    paths[filename] = file_path
        except Exception as e:
            print(f"Error loading local csv styles: {e}")

        cls._file_paths_cache = paths
        return paths

    @classmethod
    def refresh_cache(cls):
        cls._file_paths_cache = None

    @classmethod
    def get_styles_data(cls, target_file):
        styles_data = {}
        all_style_names = set()
        file_paths = cls.get_file_paths()

        if target_file and target_file in file_paths:
            file_styles = cls.load_csv(file_paths[target_file])
            if file_styles:
                styles_data[target_file] = file_styles
                all_style_names.update(file_styles.keys())

        return styles_data, sorted(list(all_style_names))

    @classmethod
    def INPUT_TYPES(cls):
        file_paths = cls.get_file_paths()
        file_names = sorted(list(file_paths.keys()))

        default_file = "None"
        if file_names:
            if cls.A1111_STYLES_KEY in file_names:
                default_file = cls.A1111_STYLES_KEY
            else:
                default_file = file_names[0]
        else:
            file_names = ["None"]

        return {
            "required": {
                "csv_file": (file_names, {"default": default_file}),
                "selected_styles": ("STRING", {"default": "[]", "multiline": False}),
            },
            "optional": {
                "positive": ("STRING", {"forceInput": True}),
                "negative": ("STRING", {"forceInput": True}),
            }
        }

    RETURN_TYPES = ("STRING", "STRING")
    RETURN_NAMES = ("positive", "negative")

    FUNCTION = "process_style"

    CATEGORY = "A1111 Styles"

    def process_style(self, csv_file, selected_styles, positive="", negative=""):
        # 選択されたファイルパスを取得して読み込む（実行時の再読み込み）
        file_paths = self.get_file_paths()

        # スタイルが未選択の場合は入力をそのままスルー出力
        if csv_file not in file_paths:
            return (positive, negative)

        target_styles = self.load_csv(file_paths[csv_file])

        pos_prompts = []
        neg_prompts = []

        if positive:
            positive = positive.strip()
            if positive.endswith(","):
                positive = positive[:-1]
            pos_prompts.append(positive)
        if negative:
            negative = negative.strip()
            if negative.endswith(","):
                negative = negative[:-1]
            neg_prompts.append(negative)

        # JSON文字列からリストを復元
        try:
            style_list = json.loads(selected_styles)
        except Exception:
            style_list = []

        for style_name in style_list:
            style_name = style_name.strip()
            if style_name and style_name in target_styles:
                pos, neg = target_styles[style_name]
                if pos:
                    pos_prompts.append(pos)
                if neg:
                    neg_prompts.append(neg)

        return (", ".join(pos_prompts), ", ".join(neg_prompts))