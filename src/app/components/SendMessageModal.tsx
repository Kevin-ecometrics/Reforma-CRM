"use client";

import { useMemo, useState } from "react";
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
  Tabs,
  Tab,
  useDisclosure,
} from "@nextui-org/react";
import { FaEnvelope, FaWhatsapp } from "react-icons/fa";
import type { Lead, MessageChannel, MessageTemplate } from "@/lib/types";

const CHANNEL_LABEL: Record<"email" | "whatsapp", string> = {
  email: "Email",
  whatsapp: "WhatsApp",
};

export function SendMessageModal({
  lead,
  templates,
  onSent,
}: {
  lead: Lead;
  templates: MessageTemplate[];
  onSent: () => void;
}) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [channel, setChannel] = useState<"email" | "whatsapp">("email");
  const [templateKey, setTemplateKey] = useState<string>("");
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; message: string } | null>(null);

  const templatesForChannel = useMemo(
    () => templates.filter((t) => t.channel === channel),
    [templates, channel]
  );

  const selectedTemplate = templatesForChannel.find((t) => t.key === templateKey);

  function changeChannel(next: "email" | "whatsapp") {
    setChannel(next);
    setTemplateKey("");
    setFeedback(null);
  }

  async function submit() {
    if (!templateKey) return;
    setSending(true);
    setFeedback(null);
    try {
      const res = await fetch(`/api/leads/${lead.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: channel as MessageChannel, templateKey }),
      });
      const data = await res.json();
      setFeedback(
        data.ok
          ? { ok: true, message: "Message sent." }
          : { ok: false, message: data.error || "Failed to send message." }
      );
      onSent();
    } catch (err) {
      setFeedback({ ok: false, message: "Failed to send message." });
    } finally {
      setSending(false);
    }
  }

  const missingContact = channel === "email" ? !lead.email : !lead.phone;

  return (
    <>
      <Button
        size="sm"
        variant="flat"
        startContent={<FaEnvelope size={12} />}
        onPress={onOpen}
      >
        Send message
      </Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Send a message to {lead.name}</ModalHeader>
              <ModalBody>
                <Tabs
                  selectedKey={channel}
                  onSelectionChange={(key) => changeChannel(key as "email" | "whatsapp")}
                  fullWidth
                >
                  <Tab
                    key="email"
                    title={
                      <div className="flex items-center gap-2">
                        <FaEnvelope size={12} /> Email
                      </div>
                    }
                  />
                  <Tab
                    key="whatsapp"
                    title={
                      <div className="flex items-center gap-2">
                        <FaWhatsapp size={12} /> WhatsApp
                      </div>
                    }
                  />
                </Tabs>

                {missingContact && (
                  <p className="text-xs text-danger">
                    This lead has no {channel === "email" ? "email address" : "phone number"} on
                    file.
                  </p>
                )}

                <Select
                  label="Template"
                  placeholder="Choose a template"
                  selectedKeys={templateKey ? [templateKey] : []}
                  onChange={(e) => setTemplateKey(e.target.value)}
                  isDisabled={templatesForChannel.length === 0}
                >
                  {templatesForChannel.map((t) => (
                    <SelectItem key={t.key} value={t.key}>
                      {t.label}
                    </SelectItem>
                  ))}
                </Select>

                {templatesForChannel.length === 0 && (
                  <p className="text-xs text-neutral-500">
                    No {CHANNEL_LABEL[channel]} templates configured yet. Add one in Settings.
                  </p>
                )}

                {selectedTemplate && (
                  <div className="text-xs text-neutral-500 border border-neutral-200 dark:border-neutral-800 rounded-md p-2 whitespace-pre-wrap">
                    {selectedTemplate.subject && (
                      <p className="font-medium mb-1">{selectedTemplate.subject}</p>
                    )}
                    {selectedTemplate.body}
                  </div>
                )}

                {feedback && (
                  <p className={`text-xs ${feedback.ok ? "text-success" : "text-danger"}`}>
                    {feedback.message}
                  </p>
                )}
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Close
                </Button>
                <Button
                  color="primary"
                  isDisabled={!templateKey || missingContact}
                  isLoading={sending}
                  onPress={submit}
                >
                  Send
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
