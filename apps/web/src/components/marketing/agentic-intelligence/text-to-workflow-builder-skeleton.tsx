import type React from 'react'

import { useEffect, useState } from 'react'

import { motion } from 'motion/react'

import { AttachmentIcon, SendIcon } from '~/components/marketing/icons/bento-icons'

import { AssistantMessage, UserMessage } from './workflow-chat-messages'

export const TextToWorkflowBuilderSkeleton = () => {
  const initialChat = [
    {
      role: 'user',
      content: 'Hello, how are you?'
    },
    {
      role: 'assistant',
      content: "I'm good, thank you! How can I help you today?"
    },
    {
      role: 'user',
      content: 'I want to create a workflow that will send an email to all my clients'
    },
    {
      role: 'assistant',
      content: 'Nah, do it yourself.'
    }
  ]

  const [chat, setChat] = useState(initialChat)
  const [inputText, setInputText] = useState('')
  const [visibleMessages, setVisibleMessages] = useState(0)
  const [currentMessageComplete, setCurrentMessageComplete] = useState(false)
  const [chatContainerRef, setChatContainerRef] = useState<HTMLDivElement | null>(null)

  const INITIAL_DELAY = 200
  const MESSAGE_DELAY = 400
  const RANDOM_MESSAGES = [
    'Do you really think I was gonna answer?',
    "I'm not a real assistant, I'm just a skeleton",
    'Meri ek taang nakli hai, mai hockey ka bohot bada khiladi tha. Ek din Uday bhai ko meri kisi baat pe gussa aagaya aur mere hi hockey se meri taang ke do tukde kar diye. Lekin dil ke bohot ache hain, fauran mujhe hospital le gaye aur ye nakli taang lagwayi',
    "Mimicking chat here, this isn't real.",
    'Bro stop.',
    'Main langotiya jeetu ka mara hua yaar bol rha hoon.'
  ]

  const handleSendMessage = () => {
    if (inputText.trim()) {
      const newMessages = [
        ...chat,
        {
          role: 'user',
          content: inputText.trim()
        },
        {
          role: 'assistant',
          content: RANDOM_MESSAGES[Math.floor(Math.random() * RANDOM_MESSAGES.length)]
        }
      ]
      setChat(newMessages)
      setVisibleMessages(newMessages.length)
      setInputText('')
      setCurrentMessageComplete(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSendMessage()
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisibleMessages(1)
    }, INITIAL_DELAY)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (currentMessageComplete && visibleMessages < chat.length) {
      const timer = setTimeout(() => {
        setVisibleMessages(prev => prev + 1)
        setCurrentMessageComplete(false)
      }, MESSAGE_DELAY)

      return () => clearTimeout(timer)
    }
  }, [currentMessageComplete, visibleMessages, chat.length])

  useEffect(() => {
    if (chatContainerRef) {
      chatContainerRef.scrollTo({
        top: chatContainerRef.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [visibleMessages, chatContainerRef])

  return (
    <motion.div className="relative mx-auto mt-2 h-full max-h-70 min-h-40 w-[85%] p-4">
      <div className="absolute inset-x-0 -bottom-4 mx-auto flex w-[85%] items-center justify-between rounded-lg border border-gray-300 bg-white shadow-[0px_2px_12px_0px_rgba(0,0,0,0.08)] dark:border-neutral-700 dark:bg-neutral-800">
        <input
          type="text"
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyPress={handleKeyPress}
          className="flex-1 border-none px-4 py-4 text-xs placeholder-neutral-600 focus:outline-none"
          placeholder="Ask Notus AI"
        />
        <div className="mr-4 flex items-center gap-2">
          <AttachmentIcon />
          <button onClick={handleSendMessage} aria-label="Send demo message" className="cursor-pointer">
            <SendIcon />
          </button>
        </div>
      </div>
      <div
        ref={setChatContainerRef}
        className="mask-bg-gradient-to-b flex max-h-[calc(100%-1rem)] flex-col gap-4 overflow-y-auto from-white to-transparent mask-t-from-70% mask-b-from-70% pt-4 pb-16 dark:from-neutral-900 dark:to-transparent"
        style={{
          scrollbarWidth: 'none',
          msOverflowStyle: 'none'
        }}
      >
        {chat.slice(0, visibleMessages).map((message, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.3 }}
          >
            {message.role === 'user' ? (
              <UserMessage
                content={message.content}
                isActive={index === visibleMessages - 1}
                onComplete={() => setCurrentMessageComplete(true)}
              />
            ) : (
              <AssistantMessage
                content={message.content}
                isActive={index === visibleMessages - 1}
                onComplete={() => setCurrentMessageComplete(true)}
              />
            )}
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
