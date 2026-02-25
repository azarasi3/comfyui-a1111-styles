from .nodes.a1111_styles_selector_base import A1111StylesSelectorBase

from .nodes.a1111_styles_selector_checkList import A1111StylesSelectorCheckList
from .nodes.a1111_styles_selector_tags import A1111StylesSelectorTags
import server
from aiohttp import web

@server.PromptServer.instance.routes.get("/a1111_styles/styles")
async def get_styles(request):
    filename = request.rel_url.query.get("filename", "")
    if not filename:
        return web.json_response([])
    
    # ノードクラスのメソッドを利用してデータを取得
    styles_data, _ = A1111StylesSelectorBase.get_styles_data(filename)
    
    if filename in styles_data:
        # 該当ファイルのスタイルリストを返す
        return web.json_response(sorted(list(styles_data[filename].keys())))
    
    return web.json_response([])

@server.PromptServer.instance.routes.get("/a1111_styles/data")
async def get_styles_data_api(request):
    filename = request.rel_url.query.get("filename", "")
    if not filename:
        return web.json_response({})
    
    styles_data, _ = A1111StylesSelectorBase.get_styles_data(filename)
    if filename in styles_data:
        return web.json_response(styles_data[filename])
    return web.json_response({})

@server.PromptServer.instance.routes.get("/a1111_styles/refresh")
async def refresh_styles(request):
    A1111StylesSelectorBase.refresh_cache()
    paths = A1111StylesSelectorBase.get_file_paths()
    file_names = sorted(list(paths.keys()))
    return web.json_response(file_names)

@server.PromptServer.instance.routes.post("/a1111_styles/save")
async def save_style(request):
    json_data = await request.json()
    filename = json_data.get("filename")
    style_name = json_data.get("style_name")
    positive = json_data.get("positive")
    negative = json_data.get("negative")

    if not filename or not style_name:
        return web.json_response({"success": False, "error": "Missing filename or style_name"})

    success, message = A1111StylesSelectorBase.save_style(filename, style_name, positive, negative)
    return web.json_response({"success": success, "error": message})

@server.PromptServer.instance.routes.post("/a1111_styles/delete")
async def delete_style(request):
    json_data = await request.json()
    filename = json_data.get("filename")
    style_name = json_data.get("style_name")

    if not filename or not style_name:
        return web.json_response({"success": False, "error": "Missing filename or style_name"})

    success, message = A1111StylesSelectorBase.delete_style(filename, style_name)
    return web.json_response({"success": success, "error": message})

NODE_CLASS_MAPPINGS = {
    "A1111_Styles_Selector_CheckList": A1111StylesSelectorCheckList,
    "A1111_Styles_Selector_Tags": A1111StylesSelectorTags
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "A1111_Styles_Selector_CheckList": "A1111 Styles Selector (CheckList)",
    "A1111_Styles_Selector_Tags": "A1111 Styles Selector (Tags)"
}

WEB_DIRECTORY = "./web/js"
__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS', 'WEB_DIRECTORY']
