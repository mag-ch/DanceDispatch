generate:
    cd apps/python-data && python generate_data.py

dev:
    just generate
    cd apps/nextjs-app && npm run dev
