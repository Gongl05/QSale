package com.example.qsale.auth.components;

import java.nio.charset.StandardCharsets;
import org.springframework.security.crypto.argon2.Argon2PasswordEncoder;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

public final class MigratingPasswordEncoder implements PasswordEncoder {
    private final Argon2PasswordEncoder current = new Argon2PasswordEncoder(16, 32, 1, 19456, 2);
    private final BCryptPasswordEncoder legacy = new BCryptPasswordEncoder();

    @Override
    public String encode(CharSequence password) { return current.encode(password); }

    @Override
    public boolean matches(CharSequence password, String encoded) {
        if (password == null || encoded == null) return false;
        if (encoded.startsWith("$argon2id$")) return current.matches(password, encoded);
        if (encoded.matches("^\\$2[aby]\\$.*") && password.toString().getBytes(StandardCharsets.UTF_8).length <= 72)
            return legacy.matches(password, encoded);
        return false;
    }

    @Override
    public boolean upgradeEncoding(String encoded) {
        return encoded == null || !encoded.startsWith("$argon2id$") || current.upgradeEncoding(encoded);
    }
}
