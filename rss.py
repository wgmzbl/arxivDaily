import feedparser
import json
import re
import time
import os

def get_new_arxiv_entries(category):
    url = f'http://arxiv.org/rss/{category}'
    feed = feedparser.parse(url)
    entries = []
    for entry in feed.entries:
        if "UPDATED" not in entry.title:
            title = re.sub(r'\(arXiv:[^\)]+\)', '', entry.title).strip()
            authors = ", ".join(re.sub(r'<.*?>|\(.*\)', '', author.name).strip() for author in entry.authors)
            arxiv_id = entry.id.split('/')[-1]
            pdf_link = f'https://arxiv.org/pdf/{arxiv_id}.pdf'
            summary = re.sub(r'<.*?>','',entry.summary).strip()
            entries.append({
                'Title': title,
                'Authors': authors,
                'Arxiv ID': arxiv_id,
                'PDF Link': pdf_link,
                'Summary': summary
            })
    update_date = time.strftime('%y%m%d', feed.updated_parsed)
    return entries, update_date

def save_to_json(entries, update_date):
    # 确保当前目录下的data目录存在
    data_dir = './data'
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
    filename = f'{data_dir}/{update_date}.json'
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False, indent=4)
    update_json_file(update_date)

def update_json_file(update_date):
    json_filename = './read.json'
    data = {update_date: False}
    if os.path.exists(json_filename):
        with open(json_filename, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
        data = {**existing_data, **data}  # 合并现有数据和新数据
    with open(json_filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
def main():
    category = 'math.DG'
    # 获取要保存的文件的名称
    url = f'http://arxiv.org/rss/{category}'
    feed = feedparser.parse(url)
    update_date = time.strftime('%y%m%d', feed.updated_parsed)
    filename = f'./data/{update_date}.json'
    # 检查文件是否已存在
    if not os.path.exists(filename):
        entries, update_date = get_new_arxiv_entries(category)
        save_to_json(entries, update_date)
    else:
        print(f'The file {filename} already exists. No action taken.')

if __name__ == '__main__':
    main()
