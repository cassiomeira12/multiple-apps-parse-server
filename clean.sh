read -r -p "This action will remove all pm2 services and instance configs, are you sure? [y/N] " response
case "$response" in
    [yY][eE][sS]|[yY])
        pm2 delete all
        rm -rf ./logs/*
        ;;
    *)
        ;;
esac
