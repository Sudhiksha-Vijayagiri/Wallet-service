-- seed.sql
-- creates an admin account + a couple of sample users so the app isn't empty
-- password for all seeded users is: Password@123
-- (hash below is bcrypt of that string, 10 rounds)

INSERT INTO users (full_name, email, password_hash, role)
VALUES
    ('Admin User', 'admin@wallet.com', '$2b$10$8K1p/a0dURXAm7QQ7SIz0eF8p8WOTM.KcHF4wPz8k1WvJ0i8nO1a2', 'admin'),
    ('Test User One', 'user1@wallet.com', '$2b$10$8K1p/a0dURXAm7QQ7SIz0eF8p8WOTM.KcHF4wPz8k1WvJ0i8nO1a2', 'user'),
    ('Test User Two', 'user2@wallet.com', '$2b$10$8K1p/a0dURXAm7QQ7SIz0eF8p8WOTM.KcHF4wPz8k1WvJ0i8nO1a2', 'user')
ON CONFLICT (email) DO NOTHING;

-- give the two test users a wallet with some starting balance
INSERT INTO wallets (user_id, balance)
SELECT id, 1000.00 FROM users WHERE email = 'user1@wallet.com'
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO wallets (user_id, balance)
SELECT id, 500.00 FROM users WHERE email = 'user2@wallet.com'
ON CONFLICT (user_id) DO NOTHING;
