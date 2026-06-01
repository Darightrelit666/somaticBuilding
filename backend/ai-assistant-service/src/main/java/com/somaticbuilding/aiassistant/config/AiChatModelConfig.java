package com.somaticbuilding.aiassistant.config;

import org.springframework.ai.chat.model.ChatModel;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;

import java.util.Map;

@Configuration
public class AiChatModelConfig {
  @Bean
  @Primary
  public ChatModel primaryChatModel(Map<String, ChatModel> chatModels) {
    ChatModel preferred = chatModels.get("openAiChatModel");
    if (preferred != null) {
      return preferred;
    }

    ChatModel fallback = chatModels.get("ollamaChatModel");
    if (fallback != null) {
      return fallback;
    }

    return chatModels.values().stream().findFirst().orElseThrow(
      () -> new IllegalStateException("No ChatModel bean available.")
    );
  }
}
