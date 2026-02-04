from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import User, Customer, Technician, Request


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['user_id', 'username', 'full_name', 'email', 'role', 'is_active', 'created_at']
        read_only_fields = ['user_id', 'created_at']


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    
    class Meta:
        model = User
        fields = ['username', 'password', 'full_name', 'email', 'role']
    
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data['username'],
            password=validated_data['password'],
            full_name=validated_data.get('full_name', ''),
            email=validated_data['email'],
            role=validated_data.get('role', 'Operator')
        )
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
