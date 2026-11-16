package com.example.qsale.security;

import jakarta.servlet.ReadListener;
import jakarta.servlet.ServletInputStream;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletRequestWrapper;
import java.io.*;
import java.nio.charset.StandardCharsets;

final class BoundedRequest extends HttpServletRequestWrapper {
    private final byte[] body;
    BoundedRequest(HttpServletRequest request) throws IOException {
        super(request);
        body = request.getInputStream().readNBytes(65537);
        if (body.length > 65536) throw new TooLarge();
    }
    @Override public ServletInputStream getInputStream() {
        ByteArrayInputStream input = new ByteArrayInputStream(body);
        return new ServletInputStream() {
            @Override public int read() { return input.read(); }
            @Override public int read(byte[] b, int off, int len) { return input.read(b, off, len); }
            @Override public boolean isFinished() { return input.available() == 0; }
            @Override public boolean isReady() { return true; }
            @Override public void setReadListener(ReadListener listener) { throw new UnsupportedOperationException("Synchronous request body"); }
        };
    }
    @Override public BufferedReader getReader() { return new BufferedReader(new InputStreamReader(getInputStream(), StandardCharsets.UTF_8)); }
    static final class TooLarge extends IOException {}
}
