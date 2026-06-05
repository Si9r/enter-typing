d = int(input())
result = []
for i in range(d):
    a,b,c = map(int,input().split())
    result.append(a + b + (24 - c))
    
print(min(result))
print(max(result))
    
