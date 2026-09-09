"use client";

import { useState } from "react";
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  useDisclosure,
} from "@nextui-org/react";
import { FaPlus } from "react-icons/fa";

export function AddLeadModal({ onCreated }: { onCreated: () => void }) {
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(onClose: () => void) {
    if (!name.trim()) return;
    setSaving(true);
    await fetch("/api/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email: email || null, phone: phone || null, source: "manual" }),
    });
    setSaving(false);
    setName("");
    setEmail("");
    setPhone("");
    onCreated();
    onClose();
  }

  return (
    <>
      <Button size="sm" color="primary" startContent={<FaPlus size={12} />} onPress={onOpen}>
        Add lead
      </Button>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Add a lead manually</ModalHeader>
              <ModalBody>
                <Input label="Name" value={name} onValueChange={setName} isRequired />
                <Input label="Email" type="email" value={email} onValueChange={setEmail} />
                <Input label="Phone" value={phone} onValueChange={setPhone} />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" isLoading={saving} onPress={() => submit(onClose)}>
                  Add lead
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
