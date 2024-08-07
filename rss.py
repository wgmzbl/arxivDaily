import feedparser
from datetime import datetime
import json
import re
import time
import os
import requests
import hashlib
from xml.etree import ElementTree

config_path = 'config.json'
def load_config(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        config = json.load(file)
    return config

config = load_config(config_path)

def hash_file(file_path):
    hasher = hashlib.sha256()
    with open(file_path, 'rb') as f:
        buf = f.read()
        hasher.update(buf)
    return hasher.hexdigest()

def find_and_delete_duplicate(file_path):
    if not os.path.isfile(file_path):
        return

    target_hash = hash_file(file_path)
    directory = os.path.dirname(file_path)

    for root, _, files in os.walk(directory):
        for file in files:
            current_file_path = os.path.join(root, file)
            if current_file_path == file_path:
                continue

            if hash_file(current_file_path) == target_hash:
                os.remove(file_path)
                print(f'Deleted duplicate file: {file_path}')
                return
    

def get_update_date(feed):
    update_date = None
    if 'published' in feed.feed:
        pub_date = datetime.strptime(feed.feed.published, '%a, %d %b %Y %H:%M:%S %z')
        update_date = pub_date.strftime('%y%m%d')

    if not update_date:
        update_date = datetime.now().strftime('%y%m%d')
    return update_date

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

def get_new_arxiv_entries(feed):
    entries = {
            "New":[],
            "Update":[],
            "New-Cross":[],
            "Update-Cross":[]
        }
    for entry in feed.entries:
        title = re.sub(r'\(arXiv:[^\)]+\)', '', entry.title).strip()
        authors = ", ".join(re.sub(r'<.*?>|\(.*\)', '', re.sub(r'\n *',', ',author.name)).strip() for author in entry.authors)
        arxiv_id = entry.id.split(':')[-1].strip().split('v')[0]
        pdf_link = f'https://arxiv.org/pdf/{arxiv_id}.pdf'
        abstract_index = entry.summary.find('Abstract: ')
        if abstract_index == -1:
            print(f'No abstract found for {title}.')
            abstract_index = 0
        else:
            abstract_index += len('Abstract: ')
        summary = re.sub(r'<.*?>','',entry.summary[abstract_index:]).strip()
        if entry.arxiv_announce_type == 'new':
            flag = 'New'
        elif entry.arxiv_announce_type == 'cross':
            flag = 'New-Cross'
        elif entry.arxiv_announce_type == 'replace':
            flag = 'Update'
        else:
            flag = 'Update-Cross'

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
    return entries

def check_if_empty(path_json):
    with open(path_json, 'r', encoding='utf-8') as f:
        entries = json.load(f)
    if entries['New']==[] and entries['Update']==[]:
        return True
    return False

def save_to_json(entries, update_date,category):
    if entries['New'] == [] and entries['Update']==[]:
        print("No articles!")
        return
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
        url = f'http://rss.arxiv.org/rss/{category}'
        feed = feedparser.parse(url)
        update_date = get_update_date(feed)
        filename = f'{config["datapath"]}/{category}/{update_date}.json'
        if not os.path.exists(f'{config["datapath"]}/{category}'):
            os.makedirs(f'{config["datapath"]}/{category}')
        if not os.path.exists(filename) or check_if_empty(filename):
            entries = get_new_arxiv_entries(feed)
            save_to_json(entries, update_date, category)
        else:
            print(f'The file {filename} already exists. No action was taken.')
        time.sleep(1)

if __name__ == '__main__':
    main()
