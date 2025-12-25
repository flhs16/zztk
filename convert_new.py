import re
import json
from bs4 import BeautifulSoup

def parse_question_type(html_content):
    soup = BeautifulSoup(html_content, 'html.parser')
    questions = []
    
    question_divs = soup.find_all('div', class_='questionLi')
    
    for idx, div in enumerate(question_divs, 1):
        question_data = {}
        
        h3 = div.find('h3', class_='mark_name')
        if h3:
            question_text = h3.find('span', class_='qtContent')
            if question_text:
                question_data['question'] = question_text.get_text(strip=True)
        
        options = []
        ul = div.find('ul', class_='mark_letter')
        if ul:
            li_elements = ul.find_all('li')
            for li in li_elements:
                option_text = li.get_text(strip=True)
                if option_text:
                    options.append(option_text)
        question_data['options'] = options
        
        right_answer_span = div.find('span', class_='rightAnswerContent')
        if right_answer_span:
            question_data['answer'] = right_answer_span.get_text(strip=True)
        
        if question_data:
            questions.append(question_data)
    
    return questions

def convert_html_to_json(input_file, output_file, question_type):
    with open(input_file, 'r', encoding='utf-8') as f:
        html_content = f.read()
    
    questions = parse_question_type(html_content)
    
    result = {
        'type': question_type,
        'questions': questions
    }
    
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"成功转换 {len(questions)} 道题目到 {output_file}")

def main():
    convert_html_to_json('d:\\WorkPlace\\学习通题库\\单选题.txt', 'd:\\WorkPlace\\学习通题库\\single_choice.json', 'single_choice')
    convert_html_to_json('d:\\WorkPlace\\学习通题库\\多选题.txt', 'd:\\WorkPlace\\学习通题库\\multiple_choice.json', 'multiple_choice')
    convert_html_to_json('d:\\WorkPlace\\学习通题库\\判断题.txt', 'd:\\WorkPlace\\学习通题库\\true_false.json', 'true_false')
    
    print("所有题库转换完成！")

if __name__ == '__main__':
    main()
