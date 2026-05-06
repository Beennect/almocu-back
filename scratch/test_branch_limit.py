import requests
import time
import random

BASE_URL = "http://localhost:3000"

def test_branch_limit():
    print("--- INICIANDO TESTE DE LIMITE DE FILIAIS ---")
    
    # 1. Registrar um novo usuário
    username = f"tester_{random.randint(1000, 9999)}"
    print(f"Registrando usuário: {username}")
    reg_resp = requests.post(f"{BASE_URL}/auth/register", json={
        "username": username,
        "password": "Password123!",
        "email": f"{username}@test.com",
        "name": "Branch Tester"
    })
    
    if reg_resp.status_code != 201:
        print(f"Erro no registro: {reg_resp.text}")
        return

    # 2. Login
    print("Realizando login...")
    login_resp = requests.post(f"{BASE_URL}/auth/login", json={
        "username": username,
        "password": "Password123!"
    })
    
    if login_resp.status_code != 201:
        print(f"Erro no login: {login_resp.text}")
        return
        
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Criar restaurante com limite de 2 filiais
    print("Criando restaurante Master com limite de 2 filiais...")
    rest_resp = requests.post(f"{BASE_URL}/restaurants", headers=headers, json={
        "name": "Matriz com Limite",
        "cnpj": "11.222.333/0001-44",
        "maxBranches": 2
    })
    
    if rest_resp.status_code != 201:
        print(f"Erro ao criar restaurante: {rest_resp.text}")
        return
        
    master_id = rest_resp.json()["_id"]
    print(f"Restaurante Master criado: {master_id}")

    # 4. Criar Filial 1 (Sucesso esperado)
    print("Criando Filial 1 (Deve funcionar)...")
    b1_resp = requests.post(f"{BASE_URL}/restaurants/branch", headers=headers, json={
        "name": "Filial 1",
        "parentId": master_id
    })
    print(f"Filial 1 status: {b1_resp.status_code}")
    assert b1_resp.status_code == 201

    # 5. Criar Filial 2 (Sucesso esperado)
    print("Criando Filial 2 (Deve funcionar)...")
    b2_resp = requests.post(f"{BASE_URL}/restaurants/branch", headers=headers, json={
        "name": "Filial 2",
        "parentId": master_id
    })
    print(f"Filial 2 status: {b2_resp.status_code}")
    assert b2_resp.status_code == 201

    # 6. Criar Filial 3 (Falha esperada - Limite atingido)
    print("Criando Filial 3 (Deve FALHAR com 409 Conflict)...")
    b3_resp = requests.post(f"{BASE_URL}/restaurants/branch", headers=headers, json={
        "name": "Filial 3",
        "parentId": master_id
    })
    
    print(f"Filial 3 status: {b3_resp.status_code}")
    if b3_resp.status_code == 409:
        print("SUCESSO: O limite foi respeitado corretamente!")
    else:
        print(f"ERRO: A filial 3 foi criada ou retornou status inesperado: {b3_resp.status_code}")
        print(f"Corpo da resposta: {b3_resp.text}")

if __name__ == "__main__":
    test_branch_limit()
