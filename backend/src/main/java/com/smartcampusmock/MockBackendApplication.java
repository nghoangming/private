package com.smartcampusmock;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.jdbc.autoconfigure.DataSourceAutoConfiguration;
import org.springframework.boot.hibernate.autoconfigure.HibernateJpaAutoConfiguration;

@SpringBootApplication(scanBasePackages = "com.smartcampusmock", exclude = {
        DataSourceAutoConfiguration.class, HibernateJpaAutoConfiguration.class
})
public class MockBackendApplication {
    public static void main(String[] args) {
        SpringApplication.run(MockBackendApplication.class, args);
    }
}
