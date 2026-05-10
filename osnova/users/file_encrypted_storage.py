import os
from io import BytesIO

from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from django.core.files.uploadedfile import TemporaryUploadedFile, InMemoryUploadedFile

from django.core.files.uploadhandler import  StopFutureHandlers, TemporaryFileUploadHandler, MemoryFileUploadHandler

from django.conf import settings



class EncryptedFileUploadHandlerMixin:
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)

        self.nonce = None
        self.encryptor = None

    def set_encryptor(self):
        self.nonce = os.urandom(16)
        self.encryptor = Cipher(
            algorithms.AES(settings.AES_KEY), modes.CTR(self.nonce)
        ).encryptor()


class EncryptedTemporaryFileUploadHandler(EncryptedFileUploadHandlerMixin, TemporaryFileUploadHandler):

    def new_file(self, *args, **kwargs):
        """
        Create the file object to append to as data is coming in.
        """
        super().new_file(*args, **kwargs)

        self.set_encryptor()

        self.file = TemporaryUploadedFile(
            self.file_name, self.content_type, 0, self.charset, self.content_type_extra
        )
        self.file.write(self.nonce)


    def receive_data_chunk(self, raw_data, start):
        self.file.write(self.encryptor.update(raw_data))

    def file_complete(self, file_size):
        self.file.write(self.encryptor.finalize())
        self.file.size = self.file.tell()
        self.file.seek(0)
        return self.file


class EncryptedMemoryFileUploadHandler(EncryptedFileUploadHandlerMixin, MemoryFileUploadHandler):
    def new_file(self, *args, **kwargs):
        # чтобы избежать вызова MemoryFileUploadHandler().new_file()
        super(MemoryFileUploadHandler, self).new_file(*args, **kwargs)
        if self.activated:
            self.set_encryptor()

            self.file = BytesIO()
            self.file.write(self.nonce)
            raise StopFutureHandlers()

    def receive_data_chunk(self, raw_data, start):
        """Add the data to the BytesIO file."""
        if self.activated:
            self.file.write(self.encryptor.update(raw_data))
        else:
            return raw_data

    def file_complete(self, file_size):
        """Return a file object if this handler is activated."""
        if not self.activated:
            return

        self.file.write(self.encryptor.finalize())
        final_size = self.file.tell()
        self.file.seek(0)

        return InMemoryUploadedFile(
            file=self.file,
            field_name=self.field_name,
            name=self.file_name,
            content_type=self.content_type,
            size=final_size ,
            charset=self.charset,
            content_type_extra=self.content_type_extra,
        )
