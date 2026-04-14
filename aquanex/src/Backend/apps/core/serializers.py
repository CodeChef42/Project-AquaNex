import secrets
from django.contrib.auth.hashers import make_password, check_password
from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, Customer, Technician, Request, Workspace, WorkspaceInvite, Gateway, Incident


class IncidentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Incident
        fields = '__all__'
        read_only_fields = ['id', 'created_at', 'detected_at', 'fingerprint']



class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['user_id', 'username', 'full_name', 'email', 'is_active', 'created_at']
        read_only_fields = ['user_id', 'created_at']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['username', 'password', 'full_name', 'email']

    def create(self, validated_data):
        # Generate a random secret key — shown to user ONCE, stored hashed
        plain_secret_key = secrets.token_urlsafe(16)

        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            full_name=validated_data.get('full_name', ''),
            email=validated_data['email'],
        )
        user.secret_key_hash = make_password(plain_secret_key)
        user.save(update_fields=['secret_key_hash'])

        # Attach plain key temporarily so the view can return it
        user._plain_secret_key = plain_secret_key
        return user
    

class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    secret_key = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate(self, data):
        user = self.context['request'].user

        if not user.check_password(data['current_password']):
            raise serializers.ValidationError({'current_password': 'Current password is incorrect.'})

        if not user.secret_key_hash:
            raise serializers.ValidationError({'secret_key': 'No secret key found for this account.'})

        if not check_password(data['secret_key'], user.secret_key_hash):
            raise serializers.ValidationError({'secret_key': 'Invalid secret key.'})

        if data['current_password'] == data['new_password']:
            raise serializers.ValidationError({'new_password': 'New password must be different from current password.'})

        return data

    def save(self):
        user = self.context['request'].user
        # Always persist a hashed password in DB.
        user.password = make_password(self.validated_data['new_password'])
        user.save(update_fields=['password'])
        return user


class LoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        username = data.get('username')
        password = data.get('password')

        print(f"DEBUG: Received username: '{username}'")
        print(f"DEBUG: Password length: {len(password) if password else 0}")

        user = authenticate(username=username, password=password)

        print(f"DEBUG: Authentication result: {user}")

        if not user:
            raise serializers.ValidationError('Invalid credentials')
        if not user.is_active:
            raise serializers.ValidationError('User account is disabled')
        data['user'] = user
        return data


class CustomerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Customer
        fields = ['id', 'user', 'name', 'address', 'phone', 'created_at']
        read_only_fields = ['id', 'created_at']


class TechnicianSerializer(serializers.ModelSerializer):
    class Meta:
        model = Technician
        fields = ['id', 'user', 'name', 'specialization', 'phone', 'is_available', 'created_at']
        read_only_fields = ['id', 'created_at']


class RequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Request
        fields = ['id', 'customer', 'technician', 'title', 'description', 'status',
                  'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class WorkspaceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Workspace
        fields = '__all__'
        read_only_fields = ['id', 'owner', 'created_at']


class WorkspaceInviteSerializer(serializers.ModelSerializer):
    class Meta:
        model = WorkspaceInvite
        fields = '__all__'
        read_only_fields = ['id', 'created_at']


class GatewaySerializer(serializers.ModelSerializer):
    class Meta:
        model = Gateway
        fields = '__all__'
        read_only_fields = ['created_at']
