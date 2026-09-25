INSERT INTO users (name, email, password, role, created_at) VALUES
    ('Admin QSale', 'admin@qsale.com', '$2a$10$AhGJxdj/2VwhIqrHYtwCOODMQ52w0znzACZmF35jrvxsmcI58LoSG', 'ADMIN', NOW())
ON CONFLICT (email) DO NOTHING;
