package com.boa.apid.mentoring.document.service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;

class PaddleOcrClientTest {

    private HttpServer server;

    @AfterEach
    void stopServer() {
        if (server != null) server.stop(0);
    }

    @Test
    void sendsRawImageBytesOverHttp11AndReturnsExtractedText() throws IOException {
        byte[] image = {1, 2, 3, 4};
        AtomicReference<byte[]> receivedImage = new AtomicReference<>();
        AtomicReference<String> receivedContentType = new AtomicReference<>();
        AtomicReference<String> receivedProtocol = new AtomicReference<>();
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/ocr", exchange -> {
            receivedImage.set(exchange.getRequestBody().readAllBytes());
            receivedContentType.set(exchange.getRequestHeaders().getFirst("Content-Type"));
            receivedProtocol.set(exchange.getProtocol());
            byte[] response = "{\"text\":\"recognized text\"}".getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);
            exchange.getResponseBody().write(response);
            exchange.close();
        });
        server.start();

        PaddleOcrClient client = new PaddleOcrClient(
                "http://127.0.0.1:" + server.getAddress().getPort() + "/ocr"
        );

        assertEquals("recognized text", client.extractText(image, "image/png"));
        assertArrayEquals(image, receivedImage.get());
        assertEquals("image/png", receivedContentType.get());
        assertEquals("HTTP/1.1", receivedProtocol.get());
    }
}
