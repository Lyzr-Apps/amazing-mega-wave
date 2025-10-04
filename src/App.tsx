import React, { useState, useRef, useEffect } from 'react';
import parseLLMJson from './utils/jsonParser';

interface Message {
  id: string;
  type: 'user' | 'agent';
  content: string;
  timestamp: Date;
  metadata?: any;
}

interface AgentResponse {
  response?: {
    main_answer?: string;
    additional_info?: string;
    suggested_links?: Array<{title: string; url: string}>;
  };
  product_info?: {
    plan_name?: string;
    features?: string[];
    pricing?: string;
    comparison?: string;
  };
  support_response?: {
    issue_summary?: string;
    steps?: string[];
    resources?: Array<{title: string; url: string}>;
  };
  feedback_processed?: {
    category?: string;
    summary?: string;
    priority?: string;
    response?: string;
  };
  metadata?: {
    confidence?: number;
    source?: string;
    priority?: string;
    sentiment_score?: number;
  };
}

const AGENT_IDS = {
  INTENT_CLASSIFICATION: '68e0de4d010a31eba98905ff',
  GENERAL_INQUIRY: '68e0de583637bc8ddc9ffa6d',
  PRODUCT_INFORMATION: '68e0de64615699d53b623ba0',
  SUPPORT_GUIDANCE: '68e0de703637bc8ddc9ffa6e',
  FEEDBACK_COLLECTION: '68e0de7df21978807e7e99dc'
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const generateRandomId = () => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  };

  const callAgent = async (agentId: string, message: string): Promise<AgentResponse | null> => {
    try {
      const userId = `user${generateRandomId()}@test.com`;
      const sessionId = `${agentId}-${generateRandomId()}`;

      const response = await fetch('https://agent-prod.studio.lyzr.ai/v3/inference/chat/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'sk-default-obhGvAo6gG9YT9tu6ChjyXLqnw7TxSGY'
        },
        body: JSON.stringify({
          user_id: userId,
          agent_id: agentId,
          session_id: sessionId,
          message: message
        })
      });

      if (!response.ok) {
        throw new Error(`Agent request failed: ${response.status}`);
      }

      const data = await response.json();
      return parseLLMJson(data.response) || data;
    } catch (error) {
      console.error('Agent call error:', error);
      return null;
    }
  };

  const classifyIntent = async (query: string): Promise<AgentResponse | null> => {
    return callAgent(AGENT_IDS.INTENT_CLASSIFICATION, query);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: Message = {
      id: generateRandomId(),
      type: 'user',
      content: inputValue.trim(),
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const intentData = await classifyIntent(userMessage.content);

      let responseData: AgentResponse | null = null;
      let agentType = 'Unknown';

      if (intentData?.target_agent) {
        const targetAgent = intentData.target_agent.toLowerCase();

        if (targetAgent.includes('general') || targetAgent.includes('inquiry')) {
          responseData = await callAgent(AGENT_IDS.GENERAL_INQUIRY, userMessage.content);
          agentType = 'General Inquiry';
        } else if (targetAgent.includes('product') || targetAgent.includes('information')) {
          responseData = await callAgent(AGENT_IDS.PRODUCT_INFORMATION, userMessage.content);
          agentType = 'Product Information';
        } else if (targetAgent.includes('support') || targetAgent.includes('guidance')) {
          responseData = await callAgent(AGENT_IDS.SUPPORT_GUIDANCE, userMessage.content);
          agentType = 'Support Guidance';
        } else if (targetAgent.includes('feedback') || targetAgent.includes('collection')) {
          responseData = await callAgent(AGENT_IDS.FEEDBACK_COLLECTION, userMessage.content);
          agentType = 'Feedback Collection';
        }
      }

      if (!responseData) {
        responseData = await callAgent(AGENT_IDS.GENERAL_INQUIRY, userMessage.content);
        agentType = 'General Inquiry (Fallback)';
      }

      let formattedResponse = '';

      if (responseData.response) {
        formattedResponse = `**${responseData.response.main_answer}**`;
        if (responseData.response.additional_info) {
          formattedResponse += `\n\n${responseData.response.additional_info}`;
        }
      } else if (responseData.product_info) {
        formattedResponse = `**${responseData.product_info.plan_name || 'Product Information'}**\n\n`;
        if (responseData.product_info.features) {
          formattedResponse += '**Features:**\n';
          responseData.product_info.features.forEach(feature => {
            formattedResponse += `• ${feature}\n`;
          });
        }
        if (responseData.product_info.pricing) {
          formattedResponse += `\n**Pricing:** ${responseData.product_info.pricing}`;
        }
      } else if (responseData.support_response) {
        formattedResponse = `**${responseData.support_response.issue_summary || 'Support Guidance'}**\n\n`;
        if (responseData.support_response.steps) {
          formattedResponse += '**Steps to resolve:**\n';
          responseData.support_response.steps.forEach((step, index) => {
            formattedResponse += `${index + 1}. ${step}\n`;
          });
        }
      } else if (responseData.feedback_processed) {
        formattedResponse = `**Feedback Received**\n\n`;
        formattedResponse += `${responseData.feedback_processed.response || 'Thank you for your feedback! We appreciate your input and will use it to improve our services.'}`;
      } else {
        formattedResponse = "I understand your query and I'm here to help! Let me assist you with your request.";
      }

      if (responseData.response?.suggested_links) {
        formattedResponse += '\n\n**Helpful Links:**';
        responseData.response.suggested_links.forEach(link => {
          formattedResponse += `\n• [${link.title}](${link.url})`;
        });
      }

      const agentMessage: Message = {
        id: generateRandomId(),
        type: 'agent',
        content: formattedResponse,
        timestamp: new Date(),
        metadata: {
          agentType,
          confidence: responseData.metadata?.confidence || 'N/A',
          source: responseData.metadata?.source || 'Lyzr Agent'
        }
      };

      setMessages(prev => [...prev, agentMessage]);
    } catch (error) {
      console.error('Error processing message:', error);
      const errorMessage: Message = {
        id: generateRandomId(),
        type: 'agent',
        content: 'I apologize, but I encountered an error processing your request. Please try again or contact support if the issue persists.',
        timestamp: new Date(),
        metadata: { agentType: 'Error', source: 'System' }
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessage = (content: string) => {
    return content.split('\n').map((line, index) => {
      if (line.startsWith('**') && line.endsWith('**')) {
        return <h3 key={index} className="font-semibold text-lyzr-primary mb-2">{line.slice(2, -2)}</h3>;
      }
      if (line.startsWith('• ')) {
        return <li key={index} className="ml-4 mb-1">{line.slice(2)}</li>;
      }
      if (line.match(/^\d+\. /)) {
        return <li key={index} className="ml-4 mb-1">{line}</li>;
      }
      if (line.startsWith('**') && line.includes(':**')) {
        const parts = line.split(':**');
        return (
          <div key={index} className="mb-2">
            <strong className="text-lyzr-primary">{parts[0].slice(2)}:</strong>{parts[1]}
          </div>
        );
      }
      return line ? <p key={index} className="mb-2">{line}</p> : <br key={index} />;
    });
  };

  return (
    <div className="min-h-screen bg-lyzr-background flex flex-col">
      {/* Header */}
      <div className="bg-lyzr-surface shadow-sm border-b border-gray-200 p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-lyzr-primary to-lyzr-secondary rounded-full flex items-center justify-center">
              <span className="text-white font-bold text-lg">L</span>
            </div>
            <div>
              <h1 className="text-lg font-semibold text-lyzr-text">Lyzr Customer Support</h1>
              <p className="text-sm text-gray-500">AI-powered assistance for all your needs</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-lyzr-success rounded-full"></div>
            <span className="text-sm text-gray-600">Online</span>
          </div>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gradient-to-r from-lyzr-primary to-lyzr-secondary rounded-full mx-auto mb-4 flex items-center justify-center">
                <span className="text-white text-2xl">💬</span>
              </div>
              <h2 className="text-xl font-semibold text-lyzr-text mb-2">Welcome to Lyzr Support!</h2>
              <p className="text-gray-600 mb-6">How can I help you today?</p>
              <div className="flex flex-wrap justify-center gap-2">
                {[
                  "Tell me about Lyzr products",
                  "How do I get support?",
                  "I need technical help",
                  "I have feedback"
                ].map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => setInputValue(suggestion)}
                    className="px-3 py-2 bg-lyzr-info bg-opacity-10 text-lyzr-info rounded-lg text-sm hover:bg-opacity-20 transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-2xl rounded-lg p-4 ${
                      message.type === 'user'
                        ? 'bg-lyzr-primary text-white'
                        : 'bg-lyzr-surface border border-gray-200 shadow-sm'
                    }`}
                  >
                    <div className={`text-sm ${message.type === 'user' ? 'text-white' : 'text-lyzr-text'}`}>
                      {formatMessage(message.content)}
                    </div>
                    {message.metadata && (
                      <div className={`text-xs mt-2 opacity-75 ${
                        message.type === 'user' ? 'text-white' : 'text-gray-500'
                      }`}>
                        {message.type === 'agent' && (
                          <>
                            {message.metadata.agentType && <span>via {message.metadata.agentType} • </span>}
                            {message.metadata.confidence && <span>confidence {message.metadata.confidence} • </span>}
                          </>
                        )}
                        {new Date(message.timestamp).toLocaleTimeString()}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="max-w-2xl rounded-lg p-4 bg-lyzr-surface border border-gray-200 shadow-sm">
                    <div className="flex space-x-2">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="bg-lyzr-surface border-t border-gray-200 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex space-x-4">
            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message here..."
                disabled={isLoading}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-lyzr-primary focus:border-transparent disabled:opacity-50"
              />
            </div>
            <button
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || isLoading}
              className="px-6 py-3 bg-gradient-to-r from-lyzr-primary to-lyzr-secondary text-white rounded-lg hover:from-lyzr-primary hover:to-lyzr-secondary focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-lyzr-primary disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium"
            >
              {isLoading ? 'Sending...' : 'Send'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
