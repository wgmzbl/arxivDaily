import feedparser
import json
import re
import time
import os
import requests
from xml.etree import ElementTree

def get_arxiv_details(arxiv_id):
    time.sleep(1)
    url = f'http://export.arxiv.org/api/query?id_list={arxiv_id}'
    response = requests.get(url)
    tree = ElementTree.fromstring(response.content)
    
    ns = {'arxiv': 'http://arxiv.org/schemas/atom'}
    for entry in tree.findall('{http://www.w3.org/2005/Atom}entry'):
        comment_elem = entry.find('arxiv:comment', ns)
        primary_subject_elem = entry.find('arxiv:primary_category', ns)
        submitTime_elem = entry.find('{http://www.w3.org/2005/Atom}published')
        all_subject_elems = entry.findall('{http://www.w3.org/2005/Atom}category')
        
        comment = comment_elem.text if comment_elem is not None else ""
        submitTime = submitTime_elem.text if submitTime_elem is not None else ""
        primary_subject = primary_subject_elem.get('term') if primary_subject_elem is not None else ""
        
        other_subjects = [elem.get('term') for elem in all_subject_elems if elem.get('term') != primary_subject]
        
        return comment, submitTime, primary_subject, other_subjects
    return "", "", "", []

def load_config(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        config = json.load(file)
    return config

config_path = 'config.json'  # 请根据需要更改路径
config = load_config(config_path)


def get_new_arxiv_entries(category):
    url = f'http://arxiv.org/rss/{category}'
    feed = feedparser.parse(url)
    entries = {
            "New":[],
            "Update":[]
        }
    for entry in feed.entries:
        title = re.sub(r'\(arXiv:[^\)]+\)', '', entry.title).strip()
        authors = ", ".join(re.sub(r'<.*?>|\(.*\)', '', author.name).strip() for author in entry.authors)
        arxiv_id = entry.id.split('/')[-1]
        pdf_link = f'https://arxiv.org/pdf/{arxiv_id}.pdf'
        summary = re.sub(r'<.*?>','',entry.summary).strip()
        if "UPDATED" not in entry.title:
            flag = 'New'
        else:
            flag = 'Update'
        comment, submitTime, primary_subject, other_subjects = get_arxiv_details(arxiv_id)
        entries[flag].append({
            'Title': title,
            'Authors': authors,
            'Arxiv ID': arxiv_id,
            'PDF Link': pdf_link,
            'Summary': summary,
            'arxiv_comment': comment,
            'submitTime': submitTime,
            'subject': {
                'primary_subject': primary_subject,
                'other_subjects': other_subjects
            }
        })
    update_date = time.strftime('%y%m%d', feed.updated_parsed)
    return entries, update_date

def check_if_empty(path_json):
    with open(path_json, 'r', encoding='utf-8') as f:
        entries = json.load(f)
    if entries['New']==[] and entries['Update']==[]:
        return True
    return False

def save_to_json(entries, update_date,category):
    # 确保entries 非空。
    if entries['New'] == [] and entries['Update']==[]:
        print("No articles!")
        return
    # 确保当前目录下的data目录存在
    data_dir = f'{config["datapath"]}/{category}'
    if not os.path.exists(data_dir):
        os.makedirs(data_dir)
    filename = f'{data_dir}/{update_date}.json'
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(entries, f, ensure_ascii=False, indent=4)
        print(f'write to {filename} success!')
    update_json_file(update_date, category)

def update_json_file(update_date, category):
    json_filename = f'{config["datapath"]}/read.json'
    data = {update_date: False}
    if os.path.exists(json_filename):
        with open(json_filename, 'r', encoding='utf-8') as f:
            existing_data = json.load(f)
        if category in existing_data:
            existing_data[category][update_date]=False
        else:
            existing_data[category]={update_date: False}
    else:
        existing_data={category:{update_date:False}}
    with open(json_filename, 'w', encoding='utf-8') as f:
        json.dump(existing_data, f, ensure_ascii=False, indent=2)

def main():
    categories = config['categories']
    for category in categories:
        url = f'http://arxiv.org/rss/{category}'
        feed = feedparser.parse(url)
        try:
            update_date = time.strftime('%y%m%d', feed.updated_parsed)
        except:
            print(feed)
            print(f'Failed to get update date for {category}. URL: {url}')
            continue
        filename = f'{config["datapath"]}/{category}/{update_date}.json'
        if not os.path.exists(f'{config["datapath"]}/{category}'):
            os.makedirs(f'{config["datapath"]}/{category}')
        if not os.path.exists(filename) or check_if_empty(filename):
            entries, update_date = get_new_arxiv_entries(category)
            save_to_json(entries, update_date, category)
        else:
            print(f'The file {filename} already exists. No action was taken.')
        time.sleep(1)

if __name__ == '__main__':
    main()
