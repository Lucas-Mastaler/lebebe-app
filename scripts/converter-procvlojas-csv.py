#!/usr/bin/env python3
"""
Converte procvlojas.md para CSV formatado para importar na tabela matic_sku
"""

import csv
import os

# Caminho relativo ao script
base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
input_file = os.path.join(base_dir, 'procvlojas.md')
output_file = os.path.join(base_dir, 'matic_sku_import.csv')

def convert_ativo(valor):
    """Converte 'Sim'/'Não' para 'true'/'false'"""
    return 'true' if valor.strip().lower() in ['sim', 'yes'] else 'false'

def clean_field(valor):
    """Limpa campos vazios e valores especiais"""
    valor = valor.strip()
    if valor in ['', '#N/A', '0']:
        return ''
    return valor

print(f"Lendo {input_file}...")

with open(input_file, 'r', encoding='utf-8') as f_in:
    lines = f_in.readlines()

# Pular header (linha 1)
data_lines = lines[1:]

rows_to_write = []
skipped = 0

for line_num, line in enumerate(data_lines, start=2):
    # Split por TAB
    parts = line.strip().split('\t')
    
    if len(parts) < 6:
        skipped += 1
        continue
    
    ref_meia = clean_field(parts[0])
    codigo_produto = clean_field(parts[1])
    descricao = clean_field(parts[2])
    ativo_raw = parts[3] if len(parts) > 3 else 'Não'
    volumes_raw = parts[4] if len(parts) > 4 else '1'
    corredor = clean_field(parts[5]) if len(parts) > 5 else ''
    ref_inteira = clean_field(parts[6]) if len(parts) > 6 else ''
    
    # Validar codigo_produto (obrigatório)
    if not codigo_produto:
        skipped += 1
        continue
    
    # Converter ativo
    ativo = convert_ativo(ativo_raw)
    
    # Validar volumes_por_item
    try:
        volumes_por_item = int(volumes_raw.strip())
    except:
        volumes_por_item = 1
    
    # nivel_sugerido não está no arquivo fonte, deixar vazio
    nivel_sugerido = ''
    
    rows_to_write.append({
        'codigo_produto': codigo_produto,
        'descricao': descricao,
        'ativo': ativo,
        'volumes_por_item': volumes_por_item,
        'corredor_sugerido': corredor,
        'nivel_sugerido': nivel_sugerido,
        'ref_meia': ref_meia,
        'ref_inteira': ref_inteira
    })

print(f"Escrevendo {output_file}...")

with open(output_file, 'w', encoding='utf-8', newline='') as f_out:
    fieldnames = ['codigo_produto', 'descricao', 'ativo', 'volumes_por_item', 
                  'corredor_sugerido', 'nivel_sugerido', 'ref_meia', 'ref_inteira']
    writer = csv.DictWriter(f_out, fieldnames=fieldnames)
    
    writer.writeheader()
    writer.writerows(rows_to_write)

print(f"✓ Concluído!")
print(f"  - {len(rows_to_write)} produtos exportados")
print(f"  - {skipped} linhas ignoradas (sem código)")
print(f"\nArquivo gerado: {output_file}")
print(f"\nPara importar no Supabase:")
print(f"1. Vá para o Supabase Dashboard > Table Editor > matic_sku")
print(f"2. Clique em 'Import data via CSV'")
print(f"3. Selecione o arquivo: matic_sku_import.csv")
print(f"4. Certifique-se que 'Skip duplicate rows' está marcado (upsert por codigo_produto)")
