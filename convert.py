#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re
import json

def extract_questions(html):
    questions = []

    parts = html.split('id="question')
    for part in parts[1:]:
        try:
            qid_match = re.search(r'(\d+)"', part)
            if not qid_match:
                continue
            qid = qid_match.group(1)

            score_match = re.search(r'\(多选题,\s*([\d.]+)分\)', part)
            score = score_match.group(1) if score_match else ''

            question_match = re.search(r'<span class="qtContent[^"]*">([^<]+)</span>', part)
            question = question_match.group(1) if question_match else ''
            question = re.sub(r'<[^>]+>', '', question).strip()
            question = re.sub(r'\s+', ' ', question)

            options = []
            option_pattern = r'<li[^>]*>(?:<span[^>]*>)?([A-D])\.\s*([^<]+)</li>'
            for opt_match in re.finditer(option_pattern, part):
                letter, content = opt_match.groups()
                content = re.sub(r'<[^>]+>', '', content).strip()
                content = re.sub(r'\s+', ' ', content)
                options.append({'letter': letter, 'content': content})

            my_answer_match = re.search(r'<span class="stuAnswerContent[^"]*">([^<]*)</span>', part)
            my_answer = my_answer_match.group(1).strip() if my_answer_match else ''

            right_answer_match = re.search(r'<span class="rightAnswerContent[^"]*">([^<]*)</span>', part)
            right_answer = right_answer_match.group(1).strip() if right_answer_match else ''

            if question and options:
                questions.append({
                    'id': qid,
                    'question': question,
                    'type': '多选题',
                    'score': score,
                    'options': options,
                    'my_answer': my_answer,
                    'right_answer': right_answer
                })
        except Exception as e:
            continue

    return questions

def convert_to_text(questions):
    lines = []
    for i, q in enumerate(questions, 1):
        lines.append(f"{i}. {q['question']}")
        for opt in q['options']:
            lines.append(f"   {opt['letter']}. {opt['content']}")
        lines.append(f"正确答案: {q['right_answer']}")
        lines.append(f"我的答案: {q['my_answer']}")
        if q['score']:
            lines.append(f"分值: {q['score']}分")
        lines.append("")
    return "\n".join(lines)

def main():
    print("正在读取文件...")
    with open('页面源码.txt', 'r', encoding='utf-8') as f:
        html = f.read()

    print("正在提取题目...")
    questions = extract_questions(html)
    print(f"成功提取 {len(questions)} 道题目")

    print("正在生成文本格式题库...")
    text_output = convert_to_text(questions)
    with open('题库.txt', 'w', encoding='utf-8-sig') as f:
        f.write('\ufeff')
        f.write(text_output)
    print("✓ 已生成题库.txt（UTF-8-BOM编码，可直接用Excel/记事本打开）")

    print("正在生成JSON格式题库...")
    json_output = json.dumps(questions, ensure_ascii=False, indent=2)
    with open('题库.json', 'w', encoding='utf-8') as f:
        f.write(json_output)
    print("✓ 已生成题库.json")

    if questions:
        correct = sum(1 for q in questions if q['my_answer'] == q['right_answer'])
        wrong = len(questions) - correct
        print(f"\n统计信息：")
        print(f"  总题数: {len(questions)}")
        print(f"  正确: {correct}")
        print(f"  错误: {wrong}")
        print(f"  正确率: {correct/len(questions)*100:.1f}%")

if __name__ == '__main__':
    main()
